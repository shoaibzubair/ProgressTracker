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
        console.log('Date:', dateStr);

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