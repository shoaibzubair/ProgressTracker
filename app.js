// app.js - Express server with MariaDB database
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database configuration
const dbConfig = {
    host: 'localhost',
    user: 'root',        // Update with your MariaDB username
    password: '<P00p>',        // Update with your MariaDB password
    database: 'progress_tracker',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Initialize database
async function initializeDatabase() {
    try {
        const connection = await pool.getConnection();
        
        // Days table stores daily task collections
        await connection.query(`CREATE TABLE IF NOT EXISTS days (
            date VARCHAR(10) PRIMARY KEY,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // Tasks table stores individual tasks
        await connection.query(`CREATE TABLE IF NOT EXISTS tasks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            date VARCHAR(10),
            task_id VARCHAR(20),
            name VARCHAR(255),
            hours FLOAT,
            completed BOOLEAN,
            hours_spent FLOAT DEFAULT 0,
            notes TEXT,
            FOREIGN KEY (date) REFERENCES days(date) ON DELETE CASCADE
        )`);
        
        // Stats table for overall statistics
        await connection.query(`CREATE TABLE IF NOT EXISTS stats (
            id INT PRIMARY KEY CHECK (id = 1),
            day_streak INT DEFAULT 0,
            last_completed_day VARCHAR(10),
            python_hours FLOAT DEFAULT 0,
            aws_hours FLOAT DEFAULT 0,
            interview_hours FLOAT DEFAULT 0,
            project_hours FLOAT DEFAULT 0,
            tech_hours FLOAT DEFAULT 0,
            portfolio_updates INT DEFAULT 0
        )`);
        
        // Notes table for quick notes
        await connection.query(`CREATE TABLE IF NOT EXISTS notes (
            id INT PRIMARY KEY CHECK (id = 1),
            content TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`);
        
        // Timer state table
        await connection.query(`CREATE TABLE IF NOT EXISTS timer_state (
            id INT PRIMARY KEY CHECK (id = 1),
            task VARCHAR(255),
            start_time BIGINT,
            elapsed_time FLOAT DEFAULT 0,
            is_running BOOLEAN DEFAULT 0
        )`);
        
        // Insert default records if they don't exist
        const [statsRows] = await connection.query('SELECT id FROM stats');
        if (statsRows.length === 0) {
            await connection.query(`INSERT INTO stats (id, day_streak, last_completed_day, python_hours, aws_hours, interview_hours, project_hours, tech_hours, portfolio_updates) 
                    VALUES (1, 0, NULL, 0, 0, 0, 0, 0, 0)`);
        }
        
        const [notesRows] = await connection.query('SELECT id FROM notes');
        if (notesRows.length === 0) {
            await connection.query('INSERT INTO notes (id, content) VALUES (1, "")');
        }
        
        const [timerRows] = await connection.query('SELECT id FROM timer_state');
        if (timerRows.length === 0) {
            await connection.query('INSERT INTO timer_state (id, task, elapsed_time, is_running) VALUES (1, "", 0, 0)');
        }
        
        connection.release();
        console.log('Database initialized successfully');
    } catch (err) {
        console.error('Error initializing database:', err);
    }
}

// Initialize the database on startup
initializeDatabase();

// API Endpoints

// Get entire state for initialization
app.get('/api/state', async (req, res) => {
    try {
        const state = { days: {}, notes: '', currentTimer: {}, stats: {} };
        const connection = await pool.getConnection();
        
        // Get all days
        const [days] = await connection.query('SELECT * FROM days');
        
        // For each day, get its tasks
        for (const day of days) {
            const [tasks] = await connection.query('SELECT * FROM tasks WHERE date = ?', [day.date]);
            state.days[day.date] = { tasks };
        }
        
        // Get notes
        const [notesRows] = await connection.query('SELECT content FROM notes WHERE id = 1');
        state.notes = notesRows.length > 0 ? notesRows[0].content : '';
        
        // Get timer state
        const [timerRows] = await connection.query('SELECT * FROM timer_state WHERE id = 1');
        if (timerRows.length > 0) {
            const timerRow = timerRows[0];
            state.currentTimer = {
                task: timerRow.task || '',
                startTime: timerRow.start_time,
                elapsedTime: timerRow.elapsed_time,
                isRunning: Boolean(timerRow.is_running)
            };
        } else {
            state.currentTimer = {
                task: '',
                startTime: null,
                elapsedTime: 0,
                isRunning: false
            };
        }
        
        // Get stats
        const [statsRows] = await connection.query('SELECT * FROM stats WHERE id = 1');
        if (statsRows.length > 0) {
            const statsRow = statsRows[0];
            state.stats = {
                dayStreak: statsRow.day_streak,
                lastCompletedDay: statsRow.last_completed_day,
                pythonHours: statsRow.python_hours,
                awsHours: statsRow.aws_hours,
                interviewHours: statsRow.interview_hours,
                projectHours: statsRow.project_hours,
                techHours: statsRow.tech_hours,
                portfolioUpdates: statsRow.portfolio_updates
            };
        } else {
            state.stats = {
                dayStreak: 0,
                lastCompletedDay: null,
                pythonHours: 0,
                awsHours: 0,
                interviewHours: 0,
                projectHours: 0,
                techHours: 0,
                portfolioUpdates: 0
            };
        }
        
        connection.release();
        res.json(state);
        
    } catch (err) {
        console.error('Error fetching state:', err);
        res.status(500).json({ error: err.message });
    }
});

// Generate tasks for a day
app.post('/api/days', async (req, res) => {
    const { date } = req.body;
    if (!date) {
        return res.status(400).json({ error: 'Date is required' });
    }
    
    try {
        const connection = await pool.getConnection();
        
        // Parse the date to get the day of month
        const dayOfMonth = new Date(date).getDate();
        
        // First, insert the day (ignore if already exists)
        await connection.query('INSERT IGNORE INTO days (date) VALUES (?)', [date]);
        
        // Define standard tasks
        const tasks = [
            {
                task_id: 'python',
                name: 'Python/Bash/PowerShell',
                hours: 2,
                completed: 0,
                hours_spent: 0,
                notes: ''
            },
            {
                task_id: 'aws',
                name: 'AWS Certification Prep',
                hours: 2,
                completed: 0,
                hours_spent: 0,
                notes: ''
            },
            {
                task_id: 'interview',
                name: 'Interview Prep',
                hours: 1,
                completed: 0,
                hours_spent: 0,
                notes: ''
            },
            {
                task_id: 'project',
                name: 'Project Work',
                hours: 4.5,
                completed: 0,
                hours_spent: 0,
                notes: ''
            },
            {
                task_id: 'tech',
                name: 'Additional Tech (Terraform/Jenkins)',
                hours: 1,
                completed: 0,
                hours_spent: 0,
                notes: ''
            }
        ];
        
        // Add portfolio task if day is divisible by 3
        if (dayOfMonth % 3 === 0) {
            tasks.push({
                task_id: 'portfolio',
                name: 'Portfolio Website Update',
                hours: 1,
                completed: 0,
                hours_spent: 0,
                notes: ''
            });
        }
        
        // Insert tasks for this day
        for (const task of tasks) {
            await connection.query(
                'INSERT INTO tasks (date, task_id, name, hours, completed, hours_spent, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [date, task.task_id, task.name, task.hours, task.completed, task.hours_spent, task.notes]
            );
        }
        
        connection.release();
        res.status(201).json({ success: true, date, taskCount: tasks.length });
        
    } catch (err) {
        console.error('Error creating day:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update task completion status
app.put('/api/tasks/:date/:taskId/completion', async (req, res) => {
    const { date, taskId } = req.params;
    const { completed } = req.body;

    try {
        const connection = await pool.getConnection();

        // Get the current task
        const [tasks] = await connection.query(
            'SELECT * FROM tasks WHERE date = ? AND task_id = ?',
            [date, taskId]
        );

        if (tasks.length === 0) {
            connection.release();
            return res.status(404).json({ error: 'Task not found' });
        }

        const task = tasks[0];

        // Adjust hours spent if marking complete or undoing
        let hoursSpent = task.hours_spent;
        if (completed && hoursSpent < task.hours) {
            hoursSpent = task.hours; // Set to target hours if marking complete
        } else if (!completed) {
            hoursSpent = 0; // Reset hours spent if undoing
        }

        // Update the task in the database
        await connection.query(
            'UPDATE tasks SET completed = ?, hours_spent = ? WHERE date = ? AND task_id = ?',
            [completed ? 1 : 0, hoursSpent, date, taskId]
        );

        // Update task stats
        const hoursDiff = completed ? (hoursSpent - task.hours_spent) : -task.hours_spent;
        await updateTaskStats(connection, taskId, hoursDiff);

        // Check and update streak only if marking as completed
        if (completed) {
            await updateStreak(connection, date);
        }

        connection.release();
        res.json({ success: true, taskId, completed });

    } catch (err) {
        console.error('Error updating task completion:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update task details
app.put('/api/tasks/:date/:taskId', async (req, res) => {
    const { date, taskId } = req.params;
    const { hoursSpent, notes } = req.body;
    
    try {
        const connection = await pool.getConnection();
        
        // Get the current task
        const [tasks] = await connection.query(
            'SELECT * FROM tasks WHERE date = ? AND task_id = ?',
            [date, taskId]
        );
        
        if (tasks.length === 0) {
            connection.release();
            return res.status(404).json({ error: 'Task not found' });
        }
        
        const task = tasks[0];
        
        // Calculate change in hours
        const hoursDiff = hoursSpent - task.hours_spent;
        
        // Update completed status if hours met
        const completed = hoursSpent >= task.hours ? 1 : task.completed;
        
        await connection.query(
            'UPDATE tasks SET hours_spent = ?, notes = ?, completed = ? WHERE date = ? AND task_id = ?',
            [hoursSpent, notes, completed, date, taskId]
        );
        
        // Update task stats
        await updateTaskStats(connection, taskId, hoursDiff);
        
        // Check and update streak
        await updateStreak(connection, date);
        
        connection.release();
        res.json({ success: true, taskId, hoursSpent, notes, completed: Boolean(completed) });
        
    } catch (err) {
        console.error('Error updating task details:', err);
        res.status(500).json({ error: err.message });
    }
});

// Save notes
app.put('/api/notes', async (req, res) => {
    const { content } = req.body;
    
    try {
        const connection = await pool.getConnection();
        
        await connection.query(
            'UPDATE notes SET content = ? WHERE id = 1',
            [content]
        );
        
        connection.release();
        res.json({ success: true });
        
    } catch (err) {
        console.error('Error updating notes:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update timer state
app.put('/api/timer', async (req, res) => {
    const { task, startTime, elapsedTime, isRunning } = req.body;
    
    try {
        const connection = await pool.getConnection();
        
        await connection.query(
            'UPDATE timer_state SET task = ?, start_time = ?, elapsed_time = ?, is_running = ? WHERE id = 1',
            [task, startTime, elapsedTime, isRunning ? 1 : 0]
        );
        
        connection.release();
        res.json({ success: true });
        
    } catch (err) {
        console.error('Error updating timer state:', err);
        res.status(500).json({ error: err.message });
    }
});

// Reset timer and update task time
app.post('/api/timer/reset', async (req, res) => {
    const { date, taskId, additionalHours } = req.body;
    
    try {
        const connection = await pool.getConnection();
        
        // Begin transaction
        await connection.beginTransaction();
        
        // Update the task with additional hours if necessary
        if (date && taskId && additionalHours > 0) {
            const [tasks] = await connection.query(
                'SELECT * FROM tasks WHERE date = ? AND task_id = ?',
                [date, taskId]
            );
            
            if (tasks.length > 0) {
                const task = tasks[0];
                const newHoursSpent = task.hours_spent + additionalHours;
                const completed = newHoursSpent >= task.hours ? 1 : task.completed;
                
                await connection.query(
                    'UPDATE tasks SET hours_spent = ?, completed = ? WHERE date = ? AND task_id = ?',
                    [newHoursSpent, completed, date, taskId]
                );
                
                // Update task stats
                await updateTaskStats(connection, taskId, additionalHours);
            }
        }
        
        // Reset timer
        await connection.query(
            'UPDATE timer_state SET task = "", start_time = NULL, elapsed_time = 0, is_running = 0 WHERE id = 1'
        );
        
        // Commit transaction
        await connection.commit();
        connection.release();
        res.json({ success: true });
        
    } catch (err) {
        const connection = await pool.getConnection();
        // Rollback if error
        await connection.rollback();
        connection.release();
        
        console.error('Error resetting timer:', err);
        res.status(500).json({ error: err.message });
    }
});

// Helper function to update task-specific stats
async function updateTaskStats(connection, taskId, hoursDiff) {
    if (hoursDiff === 0) return;
    
    let column = '';
    
    switch (taskId) {
        case 'python':
            column = 'python_hours';
            break;
        case 'aws':
            column = 'aws_hours';
            break;
        case 'interview':
            column = 'interview_hours';
            break;
        case 'project':
            column = 'project_hours';
            break;
        case 'tech':
            column = 'tech_hours';
            break;
        case 'portfolio':
            // For portfolio, we update portfolio_updates separately if hours are met
            const [portfolioTasks] = await connection.query(
                'SELECT hours, hours_spent FROM tasks WHERE task_id = "portfolio" ORDER BY date DESC LIMIT 1'
            );
            
            if (portfolioTasks.length > 0 && portfolioTasks[0].hours_spent >= portfolioTasks[0].hours) {
                await connection.query('UPDATE stats SET portfolio_updates = portfolio_updates + 1 WHERE id = 1');
            }
            return;
        default:
            return;
    }
    
    await connection.query(`UPDATE stats SET ${column} = ${column} + ? WHERE id = 1`, [hoursDiff]);
}

// Helper function to update streak
async function updateStreak(connection, currentDate) {
    // Calculate yesterday's date
    const yesterday = new Date(currentDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDate = yesterday.toISOString().split('T')[0];
    
    // Check if all tasks for today are completed
    const [todayTasks] = await connection.query('SELECT completed FROM tasks WHERE date = ?', [currentDate]);
    
    if (todayTasks.length === 0) return;
    
    const todayCompleted = todayTasks.every(task => task.completed);
    
    if (todayCompleted) {
        // Check if yesterday was completed
        const [yesterdayTasks] = await connection.query('SELECT completed FROM tasks WHERE date = ?', [yesterdayDate]);
        const yesterdayCompleted = yesterdayTasks.length > 0 && yesterdayTasks.every(task => task.completed);
        
        // Get current streak info
        const [statsRows] = await connection.query('SELECT day_streak, last_completed_day FROM stats WHERE id = 1');
        
        if (statsRows.length > 0) {
            const stats = statsRows[0];
            let newStreak = stats.day_streak;
            
            if (yesterdayCompleted || !stats.last_completed_day) {
                // Increment streak if yesterday was completed or this is first day
                newStreak++;
            } else if (stats.last_completed_day !== currentDate) {
                // Reset streak if yesterday wasn't completed
                newStreak = 1;
            }
            
            // Update streak
            await connection.query(
                'UPDATE stats SET day_streak = ?, last_completed_day = ? WHERE id = 1',
                [newStreak, currentDate]
            );
        }
    }
}

// Route for index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});