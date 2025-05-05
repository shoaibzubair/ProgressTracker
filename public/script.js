// script.js - Frontend JavaScript for Daily Progress Tracker
document.addEventListener('DOMContentLoaded', function() {
    // State variables
    const state = {
        days: {},
        notes: '',
        currentTimer: {},
        stats: {},
        selectedDate: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
        taskModalData: {
            date: null,
            taskId: null
        },
        timerInterval: null
    };

    // DOM elements
    const elements = {
        currentDate: document.getElementById('currentDate'),
        calendar: document.getElementById('calendar'),
        taskList: document.getElementById('taskList'),
        dailyTasksDate: document.getElementById('dailyTasksDate'),
        quickNotes: document.getElementById('quickNotes'),
        saveNotes: document.getElementById('saveNotes'),
        taskModal: document.getElementById('taskModal'),
        closeTaskModal: document.getElementById('closeTaskModal'),
        modalTaskTitle: document.getElementById('modalTaskTitle'),
        taskHours: document.getElementById('taskHours'),
        taskNotes: document.getElementById('taskNotes'),
        saveTaskDetails: document.getElementById('saveTaskDetails'),
        dayModal: document.getElementById('dayModal'),
        closeDayModal: document.getElementById('closeDayModal'),
        modalDayTitle: document.getElementById('modalDayTitle'),
        dayTasksList: document.getElementById('dayTasksList'),
        taskSelector: document.getElementById('taskSelector'),
        timerDisplay: document.getElementById('timerDisplay'),
        startTimer: document.getElementById('startTimer'),
        pauseTimer: document.getElementById('pauseTimer'),
        resetTimer: document.getElementById('resetTimer'),
        completionRate: document.getElementById('completionRate'),
        dayStreak: document.getElementById('dayStreak'),
        hoursInvested: document.getElementById('hoursInvested'),
        portfolioUpdates: document.getElementById('portfolioUpdates'),
        pythonProgress: document.getElementById('pythonProgress'),
        awsProgress: document.getElementById('awsProgress'),
        interviewProgress: document.getElementById('interviewProgress'),
        projectProgress: document.getElementById('projectProgress'),
        techProgress: document.getElementById('techProgress'),
        pythonHours: document.getElementById('pythonHours'),
        awsHours: document.getElementById('awsHours'),
        interviewHours: document.getElementById('interviewHours'),
        projectHours: document.getElementById('projectHours'),
        techHours: document.getElementById('techHours'),
        currentStreak: document.getElementById('currentStreak'),
        themeToggle: document.getElementById('themeToggle')
    };

    // Initialize the application
    initializeApp();

    // Main initialization function
    async function initializeApp() {
        // Set current date
        const today = new Date();
        elements.currentDate.textContent = formatDate(today);

        // Load state from server
        await loadState();

        // Initialize calendar
        initializeCalendar();

        // Load tasks for today
        loadTasksForDate(state.selectedDate);

        // Initialize notes
        elements.quickNotes.value = state.notes;

        // Initialize timer
        initializeTimer();

        // Update stats display
        updateStatsDisplay();

        // Set up event listeners
        setupEventListeners();

        // Initialize theme
        initializeTheme();
    }

    // Load state from server
    async function loadState() {
        try {
            const response = await fetch('/api/state');
            const data = await response.json();
            
            state.days = data.days || {};
            state.notes = data.notes || '';
            state.currentTimer = data.currentTimer || { 
                task: '', 
                startTime: null, 
                elapsedTime: 0, 
                isRunning: false 
            };
            state.stats = data.stats || {};
            
            console.log('State loaded:', state);
        } catch (error) {
            console.error('Error loading state:', error);
            
            // If there's an error loading the state, try to create today's tasks
            generateTasksForToday();
        }
    }

    // Generate tasks for today if they don't exist
    async function generateTasksForToday() {
        const today = new Date().toISOString().split('T')[0];
        
        if (!state.days[today]) {
            try {
                const response = await fetch('/api/days', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ date: today })
                });
                
                if (response.ok) {
                    // Reload state after generating tasks
                    await loadState();
                }
            } catch (error) {
                console.error('Error generating tasks for today:', error);
            }
        }
    }

    // Initialize calendar
    function initializeCalendar() {
        elements.calendar.innerHTML = '';

        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        // Get the first day of the month and how many days in the month
        const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

        // Add empty cells for days before the first day of the month
        for (let i = 0; i < firstDayOfMonth; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'calendar-date inactive-day';
            elements.calendar.appendChild(emptyDay);
        }

        // Create calendar days
        for (let day = 1; day <= daysInMonth; day++) {
            const dateObj = new Date(currentYear, currentMonth, day);
            const dateStr = dateObj.toISOString().split('T')[0];
            const isToday = day === today.getDate();
            const isFuture = dateObj > today;
            const isPast = dateObj < today;

            const calendarDate = document.createElement('div');
            calendarDate.className = 'calendar-date';
            calendarDate.dataset.date = dateStr;

            // Add appropriate classes for past, current, or future days
            if (isToday) {
                calendarDate.classList.add('current-day');
            } else if (isPast) {
                calendarDate.classList.add('past-day');
            } else if (isFuture) {
                calendarDate.classList.add('future-day');
            }

            // Add the 'portfolio-day' class if the day is divisible by 3
            if (day % 3 === 0) {
                calendarDate.classList.add('portfolio-day');
            }

            // Date number
            const dateNumber = document.createElement('div');
            dateNumber.className = 'calendar-date-number';
            dateNumber.textContent = day;
            calendarDate.appendChild(dateNumber);

            // Task indicators container
            const taskContainer = document.createElement('div');
            taskContainer.className = 'calendar-date-tasks';
            taskContainer.id = `calendarDay${day}`;

            // Add task completion status
            const dayData = state.days[dateStr];
            if (dayData && dayData.tasks) {
                const totalTasks = dayData.tasks.length;
                const completedTasks = dayData.tasks.filter(task => task.completed).length;

                const completionIcon = document.createElement('div');
                completionIcon.className = 'completion-icon';
                completionIcon.classList.add(completedTasks === totalTasks ? 'complete' : 'incomplete');
                taskContainer.appendChild(completionIcon);

                const taskSummary = document.createTextNode(`${completedTasks}/${totalTasks}`);
                taskContainer.appendChild(taskSummary);
            }

            calendarDate.appendChild(taskContainer);

            // Add click event to show day's tasks
            calendarDate.addEventListener('click', function () {
                state.selectedDate = dateStr;
                loadTasksForDate(dateStr);

                // Highlight selected date
                document.querySelectorAll('.calendar-date.selected').forEach(el => {
                    el.classList.remove('selected');
                });
                calendarDate.classList.add('selected');
            });

            elements.calendar.appendChild(calendarDate);
        }
    }

    // Load tasks for a specific date
    async function loadTasksForDate(date) {
        elements.taskList.innerHTML = '';
        elements.dailyTasksDate.textContent = `For ${formatDate(new Date(date))}`;

        const today = new Date().toISOString().split('T')[0];
        const isFutureDate = date > today;

        // Check if tasks for this date exist
        if (!state.days[date]) {
            if (isFutureDate) {
                elements.taskList.innerHTML = '<li class="no-tasks">Tasks cannot be edited for future dates.</li>';
                return;
            }

            // Create tasks for this date
            try {
                const response = await fetch('/api/days', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ date })
                });

                if (response.ok) {
                    // Reload state
                    await loadState();
                } else {
                    console.error('Failed to create tasks for date:', date);
                    elements.taskList.innerHTML = '<li class="no-tasks">Failed to load tasks for this day.</li>';
                    return;
                }
            } catch (error) {
                console.error('Error creating tasks for date:', error);
                elements.taskList.innerHTML = '<li class="no-tasks">Error loading tasks. Please try again.</li>';
                return;
            }
        }

        // Display tasks
        const dayData = state.days[date];
        if (dayData && dayData.tasks && dayData.tasks.length > 0) {
            dayData.tasks.forEach(task => {
                const taskItem = document.createElement('li');
                taskItem.className = 'task-item';
                taskItem.dataset.taskId = task.task_id;
                if (task.completed) {
                    taskItem.classList.add('completed');
                }

                // Checkbox
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'task-checkbox';
                checkbox.checked = task.completed;
                checkbox.disabled = isFutureDate; // Disable checkbox for future dates
                checkbox.addEventListener('change', () => toggleTaskCompletion(date, task.task_id, checkbox.checked));
                taskItem.appendChild(checkbox);

                // Task label container
                const taskLabel = document.createElement('div');
                taskLabel.className = 'task-label';

                // Task name
                const taskName = document.createElement('div');
                taskName.className = 'task-name';
                taskName.textContent = task.name;
                taskLabel.appendChild(taskName);

                // Task details
                const taskDetails = document.createElement('div');
                taskDetails.className = 'task-details';
                taskDetails.textContent = `Target: ${task.hours} hours | Completed: ${task.hours_spent} hours`;
                taskLabel.appendChild(taskDetails);

                taskItem.appendChild(taskLabel);

                // Edit button
                const editButton = document.createElement('button');
                editButton.className = 'task-edit';
                editButton.innerHTML = '<span class="edit-icon">✏️</span>';
                editButton.disabled = isFutureDate; // Disable edit button for future dates
                editButton.addEventListener('click', () => openTaskModal(date, task));
                taskItem.appendChild(editButton);

                elements.taskList.appendChild(taskItem);
            });
        } else {
            elements.taskList.innerHTML = '<li class="no-tasks">No tasks for this day.</li>';
        }
    }

    // Toggle task completion
    async function toggleTaskCompletion(date, taskId, completed) {
        const today = new Date().toISOString().split('T')[0];
        if (date > today) {
            alert('You cannot complete tasks for future dates.');
            return;
        }

        try {
            const response = await fetch(`/api/tasks/${date}/${taskId}/completion`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ completed })
            });

            if (response.ok) {
                // Update local state
                if (state.days[date]) {
                    const task = state.days[date].tasks.find(t => t.task_id === taskId);
                    if (task) {
                        task.completed = completed;
                        if (completed && task.hours_spent < task.hours) {
                            task.hours_spent = task.hours;
                        }
                    }
                }

                // Reload state to get updated stats
                await loadState();

                // Update UI
                loadTasksForDate(date);
                initializeCalendar();
                updateStatsDisplay();
            } else {
                console.error('Failed to update task completion');
            }
        } catch (error) {
            console.error('Error updating task completion:', error);
        }
    }

    // Open task modal for editing
    function openTaskModal(date, task) {
        const today = new Date().toISOString().split('T')[0];
        if (date > today) {
            alert('You cannot edit tasks for future dates.');
            return;
        }

        state.taskModalData = {
            date: date,
            taskId: task.task_id
        };

        elements.modalTaskTitle.textContent = task.name;
        elements.taskHours.value = task.hours_spent;
        elements.taskNotes.value = task.notes || '';

        elements.taskModal.style.display = 'block';
    }

    // Save task details
    async function saveTaskDetails() {
        const { date, taskId } = state.taskModalData;
        const hoursSpent = parseFloat(elements.taskHours.value) || 0;
        const notes = elements.taskNotes.value;
        
        try {
            const response = await fetch(`/api/tasks/${date}/${taskId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ hoursSpent, notes })
            });
            
            if (response.ok) {
                // Close modal
                elements.taskModal.style.display = 'none';
                
                // Reload state
                await loadState();
                
                // Update UI
                loadTasksForDate(date);
                initializeCalendar();
                updateStatsDisplay();
            } else {
                console.error('Failed to update task details');
            }
        } catch (error) {
            console.error('Error updating task details:', error);
        }
    }

    // Initialize timer
    function initializeTimer() {
        // Update task selector with today's tasks
        updateTaskSelector();
        
        // Set timer display
        const { task, elapsedTime, isRunning } = state.currentTimer;
        
        if (task) {
            elements.taskSelector.value = task;
        }
        
        elements.timerDisplay.textContent = formatTime(elapsedTime);
        
        elements.startTimer.disabled = isRunning;
        elements.pauseTimer.disabled = !isRunning;
        
        // Clear any existing interval
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
        }
        
        // Start interval if timer is running
        if (isRunning) {
            const startTime = state.currentTimer.startTime || Date.now();
            const initialElapsed = state.currentTimer.elapsedTime || 0;
            
            state.timerInterval = setInterval(() => {
                const currentTime = Date.now();
                const totalElapsed = initialElapsed + (currentTime - startTime) / 1000 / 60 / 60; // Convert to hours
                
                elements.timerDisplay.textContent = formatTime(totalElapsed);
            }, 1000);
        }
    }

    // Update task selector with today's tasks
    function updateTaskSelector() {
        const today = new Date().toISOString().split('T')[0];
        const todayData = state.days[today];
        
        // Keep default options
        const defaultOptions = Array.from(elements.taskSelector.querySelectorAll('option')).filter(opt => !opt.dataset.dynamic);
        elements.taskSelector.innerHTML = '';
        
        defaultOptions.forEach(opt => elements.taskSelector.appendChild(opt));
        
        // Add today's tasks
        if (todayData && todayData.tasks) {
            todayData.tasks.forEach(task => {
                const option = document.createElement('option');
                option.value = task.task_id;
                option.textContent = task.name;
                option.dataset.dynamic = 'true';
                elements.taskSelector.appendChild(option);
            });
        }
    }

    // Start timer
    async function startTimer() {
        const taskId = elements.taskSelector.value;
        
        if (!taskId) {
            alert('Please select a task first');
            return;
        }
        
        const startTime = Date.now();
        const elapsedTime = state.currentTimer.elapsedTime || 0;
        
        // Update UI
        elements.startTimer.disabled = true;
        elements.pauseTimer.disabled = false;
        
        // Save timer state
        try {
            await fetch('/api/timer', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    task: taskId,
                    startTime: startTime,
                    elapsedTime: elapsedTime,
                    isRunning: true
                })
            });
            
            // Update state
            state.currentTimer = {
                task: taskId,
                startTime: startTime,
                elapsedTime: elapsedTime,
                isRunning: true
            };
            
            // Start interval
            state.timerInterval = setInterval(() => {
                const currentTime = Date.now();
                const totalElapsed = elapsedTime + (currentTime - startTime) / 1000 / 60 / 60; // Convert to hours
                
                elements.timerDisplay.textContent = formatTime(totalElapsed);
            }, 1000);
        } catch (error) {
            console.error('Error starting timer:', error);
        }
    }

    // Pause timer
    async function pauseTimer() {
        // Calculate current elapsed time
        const currentTime = Date.now();
        const startTime = state.currentTimer.startTime || currentTime;
        const initialElapsed = state.currentTimer.elapsedTime || 0;
        const totalElapsed = initialElapsed + (currentTime - startTime) / 1000 / 60 / 60; // Convert to hours
        
        // Update UI
        elements.startTimer.disabled = false;
        elements.pauseTimer.disabled = true;
        
        // Clear interval
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
        }
        
        // Save timer state
        try {
            await fetch('/api/timer', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    task: state.currentTimer.task,
                    startTime: null,
                    elapsedTime: totalElapsed,
                    isRunning: false
                })
            });
            
            // Update state
            state.currentTimer = {
                task: state.currentTimer.task,
                startTime: null,
                elapsedTime: totalElapsed,
                isRunning: false
            };
        } catch (error) {
            console.error('Error pausing timer:', error);
        }
    }

    // Reset timer
    async function resetTimer() {
        // Calculate current elapsed time if timer is running
        let additionalHours = 0;
        
        if (state.currentTimer.isRunning) {
            const currentTime = Date.now();
            const startTime = state.currentTimer.startTime || currentTime;
            const initialElapsed = state.currentTimer.elapsedTime || 0;
            additionalHours = initialElapsed + (currentTime - startTime) / 1000 / 60 / 60; // Convert to hours
        } else {
            additionalHours = state.currentTimer.elapsedTime || 0;
        }
        
        // Clear interval
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
        }
        
        // Update UI
        elements.timerDisplay.textContent = '00:00:00';
        elements.startTimer.disabled = false;
        elements.pauseTimer.disabled = true;
        
        // Reset timer and update task time
        const today = new Date().toISOString().split('T')[0];
        
        try {
            await fetch('/api/timer/reset', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    date: today,
                    taskId: state.currentTimer.task,
                    additionalHours: additionalHours
                })
            });
            
            // Update state
            state.currentTimer = {
                task: '',
                startTime: null,
                elapsedTime: 0,
                isRunning: false
            };
            
            // Reset task selector
            elements.taskSelector.value = '';
            
            // Reload state and update UI
            await loadState();
            loadTasksForDate(state.selectedDate);
            initializeCalendar();
            updateStatsDisplay();
        } catch (error) {
            console.error('Error resetting timer:', error);
        }
    }

    // Save notes
    async function saveNotes() {
        const content = elements.quickNotes.value;
        
        try {
            const response = await fetch('/api/notes', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ content })
            });
            
            if (response.ok) {
                // Update state
                state.notes = content;
                
                // Show saved message
                const saveBtn = elements.saveNotes;
                const originalText = saveBtn.textContent;
                saveBtn.textContent = 'Saved!';
                setTimeout(() => {
                    saveBtn.textContent = originalText;
                }, 2000);
            } else {
                console.error('Failed to save notes');
            }
        } catch (error) {
            console.error('Error saving notes:', error);
        }
    }

    // Update stats display
    function updateStatsDisplay() {
        const stats = state.stats;
        
        // Calculate completion rate
        let totalTasks = 0;
        let completedTasks = 0;
        
        Object.values(state.days).forEach(day => {
            if (day.tasks) {
                totalTasks += day.tasks.length;
                completedTasks += day.tasks.filter(task => task.completed).length;
            }
        });
        
        const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
        
        // Calculate total hours invested
        const totalHours = (stats.pythonHours || 0) + 
                          (stats.awsHours || 0) + 
                          (stats.interviewHours || 0) + 
                          (stats.projectHours || 0) + 
                          (stats.techHours || 0);
        
        // Update stats cards
        elements.completionRate.textContent = `${Math.round(completionRate)}%`;
        elements.dayStreak.textContent = stats.dayStreak || 0;
        elements.hoursInvested.textContent = Math.round(totalHours * 10) / 10;
        elements.portfolioUpdates.textContent = stats.portfolioUpdates || 0;
        
        // Update progress bars
        // Target hours for May (31 days)
        const pythonTarget = 2 * 31; // 2 hours per day
        const awsTarget = 2 * 31;
        const interviewTarget = 1 * 31;
        const projectTarget = 4.5 * 31;
        const techTarget = 1 * 31;
        
        elements.pythonProgress.style.width = `${Math.min(100, ((stats.pythonHours || 0) / pythonTarget) * 100)}%`;
        elements.awsProgress.style.width = `${Math.min(100, ((stats.awsHours || 0) / awsTarget) * 100)}%`;
        elements.interviewProgress.style.width = `${Math.min(100, ((stats.interviewHours || 0) / interviewTarget) * 100)}%`;
        elements.projectProgress.style.width = `${Math.min(100, ((stats.projectHours || 0) / projectTarget) * 100)}%`;
        elements.techProgress.style.width = `${Math.min(100, ((stats.techHours || 0) / techTarget) * 100)}%`;
        
        // Update time distribution
        elements.pythonHours.textContent = Math.round((stats.pythonHours || 0) * 10) / 10;
        elements.awsHours.textContent = Math.round((stats.awsHours || 0) * 10) / 10;
        elements.interviewHours.textContent = Math.round((stats.interviewHours || 0) * 10) / 10;
        elements.projectHours.textContent = Math.round((stats.projectHours || 0) * 10) / 10;
        elements.techHours.textContent = Math.round((stats.techHours || 0) * 10) / 10;
        
        // Update streak
        elements.currentStreak.textContent = stats.dayStreak || 0;
    }

    // Set up event listeners
    function setupEventListeners() {
        // Task modal
        elements.closeTaskModal.addEventListener('click', () => {
            elements.taskModal.style.display = 'none';
        });
        
        elements.saveTaskDetails.addEventListener('click', saveTaskDetails);
        
        // Day modal
        elements.closeDayModal.addEventListener('click', () => {
            elements.dayModal.style.display = 'none';
        });
        
        // Timer controls
        elements.startTimer.addEventListener('click', startTimer);
        elements.pauseTimer.addEventListener('click', pauseTimer);
        elements.resetTimer.addEventListener('click', resetTimer);
        
        // Notes
        elements.saveNotes.addEventListener('click', saveNotes);
        
        // Theme toggle
        elements.themeToggle.addEventListener('change', toggleTheme);
        
        // Close modals when clicking outside
        window.addEventListener('click', (event) => {
            if (event.target === elements.taskModal) {
                elements.taskModal.style.display = 'none';
            }
            if (event.target === elements.dayModal) {
                elements.dayModal.style.display = 'none';
            }
        });
    }

    // Initialize theme
    function initializeTheme() {
        const darkModeEnabled = localStorage.getItem('darkMode') === 'true';
        elements.themeToggle.checked = darkModeEnabled;
        
        if (darkModeEnabled) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    }

    // Toggle theme
    function toggleTheme() {
        const darkModeEnabled = elements.themeToggle.checked;
        
        if (darkModeEnabled) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        
        localStorage.setItem('darkMode', darkModeEnabled);
    }

    // Helper function: Format date
    function formatDate(date) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    }

    // Helper function: Format time
    function formatTime(hours) {
        const totalSeconds = Math.floor(hours * 60 * 60);
        
        const displayHours = Math.floor(totalSeconds / 3600);
        const displayMinutes = Math.floor((totalSeconds % 3600) / 60);
        const displaySeconds = totalSeconds % 60;
        
        return [
            displayHours.toString().padStart(2, '0'),
            displayMinutes.toString().padStart(2, '0'),
            displaySeconds.toString().padStart(2, '0')
        ].join(':');
    }
});