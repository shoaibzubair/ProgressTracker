// app.js - Express server with SQLite3 database
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize SQLite database
const db = new sqlite3.Database('./progress_tracker.db', (err) => {
    if (err) {
        console.error('Error opening database', err);
    } else {
        console.log('Connected to the SQLite database.');
        initializeDatabase();
    }
});

// Create database tables if they don't exist
function initializeDatabase() {
    db.serialize(() => {
        // Days table stores daily task collections
        db.run(`CREATE TABLE IF NOT EXISTS days (
            date TEXT PRIMARY KEY,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // Tasks table stores individual tasks
        db.run(`CREATE TABLE IF NOT EXISTS tasks (
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
        
        // Stats table for overall statistics
        db.run(`CREATE TABLE IF NOT EXISTS stats (
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
        
        // Notes table for quick notes
        db.run(`CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            content TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // Timer state table
        db.run(`CREATE TABLE IF NOT EXISTS timer_state (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            task TEXT,
            start_time INTEGER,
            elapsed_time REAL DEFAULT 0,
            is_running BOOLEAN DEFAULT 0
        )`);
        
        // Insert default records if they don't exist
        db.get(`SELECT id FROM stats`, [], (err, row) => {
            if (!row) {
                db.run(`INSERT INTO stats (id, day_streak, last_completed_day, python_hours, aws_hours, interview_hours, project_hours, tech_hours, portfolio_updates) 
                        VALUES (1, 0, NULL, 0, 0, 0, 0, 0, 0)`);
            }
        });
        
        db.get(`SELECT id FROM notes`, [], (err, row) => {
            if (!row) {
                db.run(`INSERT INTO notes (id, content) VALUES (1, '')`);
            }
        });
        
        db.get(`SELECT id FROM timer_state`, [], (err, row) => {
            if (!row) {
                db.run(`INSERT INTO timer_state (id, task, elapsed_time, is_running) VALUES (1, '', 0, 0)`);
            }
        });
    });
}

// API Endpoints

// Get entire state for initialization
app.get('/api/state', (req, res) => {
    const state = { days: {}, notes: '', currentTimer: {}, stats: {} };
    
    // Get all days and tasks
    db.all(`SELECT * FROM days`, [], (err, days) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        // For each day, get its tasks
        let pendingDays = days.length;
        if (pendingDays === 0) {
            getRestOfState();
        }
        
        days.forEach(day => {
            db.all(`SELECT * FROM tasks WHERE date = ?`, [day.date], (err, tasks) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                
                state.days[day.date] = { tasks };
                
                pendingDays--;
                if (pendingDays === 0) {
                    getRestOfState();
                }
            });
        });
    });
    
    function getRestOfState() {
        // Get notes
        db.get(`SELECT content FROM notes WHERE id = 1`, [], (err, notesRow) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            state.notes = notesRow ? notesRow.content : '';
            
            // Get timer state
            db.get(`SELECT * FROM timer_state WHERE id = 1`, [], (err, timerRow) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                
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
                db.get(`SELECT * FROM stats WHERE id = 1`, [], (err, statsRow) => {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
                    
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
                });
            });
        });
    }
});

// Generate tasks for a day
app.post('/api/days', (req, res) => {
    const { date } = req.body;
    if (!date) {
        return res.status(400).json({ error: 'Date is required' });
    }
    
    // Parse the date to get the day of month
    const dayOfMonth = new Date(date).getDate();
    
    // First, insert the day
    db.run(`INSERT OR IGNORE INTO days (date) VALUES (?)`, [date], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
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
        const insertTask = db.prepare(`INSERT INTO tasks (date, task_id, name, hours, completed, hours_spent, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`);
        tasks.forEach(task => {
            insertTask.run([date, task.task_id, task.name, task.hours, task.completed, task.hours_spent, task.notes]);
        });
        insertTask.finalize();
        
        res.status(201).json({ success: true, date, taskCount: tasks.length });
    });
});

// Update task completion status
app.put('/api/tasks/:date/:taskId/completion', (req, res) => {
    const { date, taskId } = req.params;
    const { completed } = req.body;
    
    db.get(`SELECT * FROM tasks WHERE date = ? AND task_id = ?`, [date, taskId], (err, task) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        // If marking complete and hours not met, set hours spent to target
        let hoursSpent = task.hours_spent;
        if (completed && hoursSpent < task.hours) {
            hoursSpent = task.hours;
        }
        
        db.run(`UPDATE tasks SET completed = ?, hours_spent = ? WHERE date = ? AND task_id = ?`, 
            [completed ? 1 : 0, hoursSpent, date, taskId], function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            // Update task stats if completing
            if (completed) {
                updateTaskStats(taskId, hoursSpent - task.hours_spent);
            }
            
            // Check and update streak
            updateStreak(date);
            
            res.json({ success: true, taskId, completed });
        });
    });
});

// Update task details
app.put('/api/tasks/:date/:taskId', (req, res) => {
    const { date, taskId } = req.params;
    const { hoursSpent, notes } = req.body;
    
    db.get(`SELECT * FROM tasks WHERE date = ? AND task_id = ?`, [date, taskId], (err, task) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        // Calculate change in hours
        const hoursDiff = hoursSpent - task.hours_spent;
        
        // Update completed status if hours met
        const completed = hoursSpent >= task.hours ? 1 : task.completed;
        
        db.run(`UPDATE tasks SET hours_spent = ?, notes = ?, completed = ? WHERE date = ? AND task_id = ?`,
            [hoursSpent, notes, completed, date, taskId], function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            // Update task stats
            updateTaskStats(taskId, hoursDiff);
            
            // Check and update streak
            updateStreak(date);
            
            res.json({ success: true, taskId, hoursSpent, notes, completed: Boolean(completed) });
        });
    });
});

// Save notes
app.put('/api/notes', (req, res) => {
    const { content } = req.body;
    
    db.run(`UPDATE notes SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1`, [content], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        res.json({ success: true });
    });
});

// Update timer state
app.put('/api/timer', (req, res) => {
    const { task, startTime, elapsedTime, isRunning } = req.body;
    
    db.run(`UPDATE timer_state SET task = ?, start_time = ?, elapsed_time = ?, is_running = ? WHERE id = 1`,
        [task, startTime, elapsedTime, isRunning ? 1 : 0], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        res.json({ success: true });
    });
});

// Reset timer and update task time
app.post('/api/timer/reset', (req, res) => {
    const { date, taskId, additionalHours } = req.body;
    
    // Begin transaction
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // Update the task with additional hours if necessary
        if (date && taskId && additionalHours > 0) {
            db.get(`SELECT * FROM tasks WHERE date = ? AND task_id = ?`, [date, taskId], (err, task) => {
                if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: err.message });
                }
                
                if (task) {
                    const newHoursSpent = task.hours_spent + additionalHours;
                    const completed = newHoursSpent >= task.hours ? 1 : task.completed;
                    
                    db.run(`UPDATE tasks SET hours_spent = ?, completed = ? WHERE date = ? AND task_id = ?`,
                        [newHoursSpent, completed, date, taskId], function(err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: err.message });
                        }
                        
                        // Update task stats
                        updateTaskStats(taskId, additionalHours);
                        
                        // Reset timer
                        resetTimer();
                    });
                } else {
                    // Reset timer even if task not found
                    resetTimer();
                }
            });
        } else {
            // Just reset timer if no task to update
            resetTimer();
        }
        
        function resetTimer() {
            db.run(`UPDATE timer_state SET task = '', start_time = NULL, elapsed_time = 0, is_running = 0 WHERE id = 1`, function(err) {
                if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: err.message });
                }
                
                db.run('COMMIT');
                res.json({ success: true });
            });
        }
    });
});

// Helper function to update task-specific stats
function updateTaskStats(taskId, hoursDiff) {
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
            db.get(`SELECT hours, hours_spent FROM tasks WHERE task_id = 'portfolio' ORDER BY date DESC LIMIT 1`, [], (err, task) => {
                if (err) return;
                
                if (task && task.hours_spent >= task.hours) {
                    db.run(`UPDATE stats SET portfolio_updates = portfolio_updates + 1 WHERE id = 1`);
                }
            });
            return;
        default:
            return;
    }
    
    db.run(`UPDATE stats SET ${column} = ${column} + ? WHERE id = 1`, [hoursDiff]);
}

// Helper function to update streak
function updateStreak(currentDate) {
    const yesterday = new Date(currentDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDate = yesterday.toISOString().split('T')[0];
    
    // Check if all tasks for today are completed
    db.all(`SELECT completed FROM tasks WHERE date = ?`, [currentDate], (err, todayTasks) => {
        if (err || todayTasks.length === 0) return;
        
        const todayCompleted = todayTasks.every(task => task.completed);
        
        if (todayCompleted) {
            // Check if yesterday was completed
            db.all(`SELECT completed FROM tasks WHERE date = ?`, [yesterdayDate], (err, yesterdayTasks) => {
                const yesterdayCompleted = !err && yesterdayTasks.length > 0 && yesterdayTasks.every(task => task.completed);
                
                // Get current streak info
                db.get(`SELECT day_streak, last_completed_day FROM stats WHERE id = 1`, [], (err, stats) => {
                    if (err) return;
                    
                    let newStreak = stats.day_streak;
                    
                    if (yesterdayCompleted || !stats.last_completed_day) {
                        // Increment streak if yesterday was completed or this is first day
                        newStreak++;
                    } else if (stats.last_completed_day !== currentDate) {
                        // Reset streak if yesterday wasn't completed
                        newStreak = 1;
                    }
                    
                    // Update streak
                    db.run(`UPDATE stats SET day_streak = ?, last_completed_day = ? WHERE id = 1`, [newStreak, currentDate]);
                });
            });
        }
    });
}

// Route for index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});