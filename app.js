// app.js - Express server with SQLite database
const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const { Database } = require('sqlite');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database variable
let db;

// Initialize SQLite database
async function initializeDatabase() {
    try {
        // Create a new Database instance directly
        db = new Database();
        
        // Open the database file
        await db.open('./progress_tracker.db');
        console.log('Connected to the SQLite database.');
        
        // Create tables if they don't exist
        await db.exec(`CREATE TABLE IF NOT EXISTS days (
            date TEXT PRIMARY KEY,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        
        await db.exec(`CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            task_id TEXT,
            name TEXT,
            hours REAL,
            completed BOOLEAN,
            hours_spent REAL DEFAULT 0,
            notes TEXT,
            FOREIGN KEY (date) REFERENCES days(date)
        )`);
        
        await db.exec(`CREATE TABLE IF NOT EXISTS stats (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            day_streak INTEGER DEFAULT 0,
            last_completed_day TEXT,
            python_hours REAL DEFAULT 0,
            aws_hours REAL DEFAULT 0,
            interview_hours REAL DEFAULT 0,
            project_hours REAL DEFAULT 0,
            tech_hours REAL DEFAULT 0,
            portfolio_updates INTEGER DEFAULT 0
        )`);
        
        await db.exec(`CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            content TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        
        await db.exec(`CREATE TABLE IF NOT EXISTS timer_state (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            task TEXT,
            start_time INTEGER,
            elapsed_time REAL DEFAULT 0,
            is_running BOOLEAN DEFAULT 0
        )`);
        
        // Insert default records if they don't exist
        const statsRow = await db.get(`SELECT id FROM stats`);
        if (!statsRow) {
            await db.run(`INSERT INTO stats (id, day_streak, last_completed_day, python_hours, aws_hours, interview_hours, project_hours, tech_hours, portfolio_updates) 
                    VALUES (1, 0, NULL, 0, 0, 0, 0, 0, 0)`);
        }
        
        const notesRow = await db.get(`SELECT id FROM notes`);
        if (!notesRow) {
            await db.run(`INSERT INTO notes (id, content) VALUES (1, '')`);
        }
        
        const timerRow = await db.get(`SELECT id FROM timer_state`);
        if (!timerRow) {
            await db.run(`INSERT INTO timer_state (id, task, elapsed_time, is_running) VALUES (1, '', 0, 0)`);
        }
    } catch (err) {
        console.error('Error initializing database:', err);
        process.exit(1);
    }
}

// API Endpoints

// Get entire state for initialization
app.get('/api/state', async (req, res) => {
    try {
        const state = { days: {}, notes: '', currentTimer: {}, stats: {} };
        
        // Get all days
        const days = await db.all(`SELECT * FROM days`);
        
        // For each day, get its tasks
        for (const day of days) {
            const tasks = await db.all(`SELECT * FROM tasks WHERE date = ?`, [day.date]);
            state.days[day.date] = { tasks };
        }
        
        // Get notes
        const notesRow = await db.get(`SELECT content FROM notes WHERE id = 1`);
        state.notes = notesRow ? notesRow.content : '';
        
        // Get timer state
        const timerRow = await db.get(`SELECT * FROM timer_state WHERE id = 1`);
        if (timerRow) {
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
        const statsRow = await db.get(`SELECT * FROM stats WHERE id = 1`);
        if (statsRow) {
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
        
        // Return full state
        res.json(state);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Generate tasks for a day
app.post('/api/days', async (req, res) => {
    try {
        const { date } = req.body;
        if (!date) {
            return res.status(400).json({ error: 'Date is required' });
        }
        
        // Parse the date to get the day of month
        const dayOfMonth = new Date(date).getDate();
        
        // First, insert the day
        await db.run(`INSERT OR IGNORE INTO days (date) VALUES (?)`, [date]);
        
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
            await db.run(
                `INSERT INTO tasks (date, task_id, name, hours, completed, hours_spent, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [date, task.task_id, task.name, task.hours, task.completed, task.hours_spent, task.notes]
            );
        }
        
        res.status(201).json({ success: true, date, taskCount: tasks.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update task completion status
app.put('/api/tasks/:date/:taskId/completion', async (req, res) => {
    try {
        const { date, taskId } = req.params;
        const { completed } = req.body;
        
        const task = await db.get(`SELECT * FROM tasks WHERE date = ? AND task_id = ?`, [date, taskId]);
        
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        // If marking complete and hours not met, set hours spent to target
        let hoursSpent = task.hours_spent;
        if (completed && hoursSpent < task.hours) {
            hoursSpent = task.hours;
        }
        
        await db.run(
            `UPDATE tasks SET completed = ?, hours_spent = ? WHERE date = ? AND task_id = ?`, 
            [completed ? 1 : 0, hoursSpent, date, taskId]
        );
        
        // Update task stats if completing
        if (completed) {
            await updateTaskStats(taskId, hoursSpent - task.hours_spent);
        }
        
        // Check and update streak
        await updateStreak(date);
        
        res.json({ success: true, taskId, completed });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update task details
app.put('/api/tasks/:date/:taskId', async (req, res) => {
    try {
        const { date, taskId } = req.params;
        const { hoursSpent, notes } = req.body;
        
        const task = await db.get(`SELECT * FROM tasks WHERE date = ? AND task_id = ?`, [date, taskId]);
        
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        // Calculate change in hours
        const hoursDiff = hoursSpent - task.hours_spent;
        
        // Update completed status if hours met
        const completed = hoursSpent >= task.hours ? 1 : task.completed;
        
        await db.run(
            `UPDATE tasks SET hours_spent = ?, notes = ?, completed = ? WHERE date = ? AND task_id = ?`,
            [hoursSpent, notes, completed, date, taskId]
        );
        
        // Update task stats
        await updateTaskStats(taskId, hoursDiff);
        
        // Check and update streak
        await updateStreak(date);
        
        res.json({ success: true, taskId, hoursSpent, notes, completed: Boolean(completed) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Save notes
app.put('/api/notes', async (req, res) => {
    try {
        const { content } = req.body;
        
        await db.run(
            `UPDATE notes SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1`, 
            [content]
        );
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update timer state
app.put('/api/timer', async (req, res) => {
    try {
        const { task, startTime, elapsedTime, isRunning } = req.body;
        
        await db.run(
            `UPDATE timer_state SET task = ?, start_time = ?, elapsed_time = ?, is_running = ? WHERE id = 1`,
            [task, startTime, elapsedTime, isRunning ? 1 : 0]
        );
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reset timer and update task time
app.post('/api/timer/reset', async (req, res) => {
    try {
        const { date, taskId, additionalHours } = req.body;
        
        // Begin transaction
        await db.run('BEGIN TRANSACTION');
        
        // Update the task with additional hours if necessary
        if (date && taskId && additionalHours > 0) {
            const task = await db.get(`SELECT * FROM tasks WHERE date = ? AND task_id = ?`, [date, taskId]);
            
            if (task) {
                const newHoursSpent = task.hours_spent + additionalHours;
                const completed = newHoursSpent >= task.hours ? 1 : task.completed;
                
                await db.run(
                    `UPDATE tasks SET hours_spent = ?, completed = ? WHERE date = ? AND task_id = ?`,
                    [newHoursSpent, completed, date, taskId]
                );
                
                // Update task stats
                await updateTaskStats(taskId, additionalHours);
            }
        }
        
        // Reset timer
        await db.run(`UPDATE timer_state SET task = '', start_time = NULL, elapsed_time = 0, is_running = 0 WHERE id = 1`);
        
        await db.run('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await db.run('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// Helper function to update task-specific stats
async function updateTaskStats(taskId, hoursDiff) {
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
            const task = await db.get(`SELECT hours, hours_spent FROM tasks WHERE task_id = 'portfolio' ORDER BY date DESC LIMIT 1`);
            if (task && task.hours_spent >= task.hours) {
                await db.run(`UPDATE stats SET portfolio_updates = portfolio_updates + 1 WHERE id = 1`);
            }
            return;
        default:
            return;
    }
    
    await db.run(`UPDATE stats SET ${column} = ${column} + ? WHERE id = 1`, [hoursDiff]);
}

// Helper function to update streak
async function updateStreak(currentDate) {
    try {
        const yesterday = new Date(currentDate);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayDate = yesterday.toISOString().split('T')[0];
        
        // Check if all tasks for today are completed
        const todayTasks = await db.all(`SELECT completed FROM tasks WHERE date = ?`, [currentDate]);
        
        if (todayTasks.length === 0) return;
        
        const todayCompleted = todayTasks.every(task => task.completed);
        
        if (todayCompleted) {
            // Check if yesterday was completed
            const yesterdayTasks = await db.all(`SELECT completed FROM tasks WHERE date = ?`, [yesterdayDate]);
            const yesterdayCompleted = yesterdayTasks.length > 0 && yesterdayTasks.every(task => task.completed);
            
            // Get current streak info
            const stats = await db.get(`SELECT day_streak, last_completed_day FROM stats WHERE id = 1`);
            
            let newStreak = stats.day_streak;
            
            if (yesterdayCompleted || !stats.last_completed_day) {
                // Increment streak if yesterday was completed or this is first day
                newStreak++;
            } else if (stats.last_completed_day !== currentDate) {
                // Reset streak if yesterday wasn't completed
                newStreak = 1;
            }
            
            // Update streak
            await db.run(`UPDATE stats SET day_streak = ?, last_completed_day = ? WHERE id = 1`, [newStreak, currentDate]);
        }
    } catch (err) {
        console.error('Error updating streak:', err);
    }
}

// Route for index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start application
async function startApp() {
    await initializeDatabase();
    
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

// Run the application
startApp().catch(err => {
    console.error('Failed to start application:', err);
    process.exit(1);
});