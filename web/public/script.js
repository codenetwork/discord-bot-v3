async function fetchUseres ()
{
    const response = await fetch('/api/user-count');
    const count = await response.json();
    console.log(count);
    return count;
}
async function fetchCommands()
{
    const response = await fetch('/api/commands');
    const commands = await response.json();
    console.log(commands);
    return commands;
}
document.addEventListener('DOMContentLoaded', function() {
    // Navigation functionality
    const menuItems = document.querySelectorAll('.sidebar-menu li');
    const pages = document.querySelectorAll('.page');
    
    const count = document.getElementById('user-count');
    fetchUseres().then(data => {
        count.innerHTML = data.count;
    }
    );
    menuItems.forEach(item => {
        item.addEventListener('click', function() {
            // Remove active class from all menu items
            menuItems.forEach(menuItem => {
                menuItem.classList.remove('active');
            });
            
            // Add active class to clicked menu item
            this.classList.add('active');
            
            // Hide all pages
            pages.forEach(page => {
                page.classList.remove('active');
            });
            
            // Show the corresponding page
            const targetPage = document.getElementById(this.dataset.target);
            if (targetPage) {
                targetPage.classList.add('active');
            }
        });
    });
    
    // Toggle sidebar
    const toggleSidebarBtn = document.getElementById('toggleSidebar');
    const sidebar = document.querySelector('.sidebar');
    
    if (toggleSidebarBtn) {
        toggleSidebarBtn.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
            
            if (sidebar.classList.contains('collapsed')) {
                sidebar.style.width = '70px';
                document.querySelectorAll('.sidebar .logo span, .sidebar-menu li span, .sidebar-footer .info')
                    .forEach(el => el.style.display = 'none');
                
                document.querySelectorAll('.sidebar-menu li')
                    .forEach(el => {
                        el.style.justifyContent = 'center';
                        el.querySelector('i').style.marginRight = '0';
                    });
            } else {
                sidebar.style.width = '250px';
                
                // Delay the display of text to make the animation smoother
                setTimeout(() => {
                    document.querySelectorAll('.sidebar .logo span, .sidebar-menu li span, .sidebar-footer .info')
                        .forEach(el => el.style.display = 'block');
                    
                    document.querySelectorAll('.sidebar-menu li')
                        .forEach(el => {
                            el.style.justifyContent = 'flex-start';
                            el.querySelector('i').style.marginRight = '12px';
                        });
                }, 150);
            }
        });
    }
    
    // Settings tabs
    const settingsTabs = document.querySelectorAll('.settings-sidebar li');
    
    settingsTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            settingsTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            // Here you would add code to show the corresponding settings panel
        });
    });
    
    // Filter buttons in chart
    const filterBtns = document.querySelectorAll('.btn-filter');
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            filterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            // Here you would add code to update the chart
        });
    });
    
    // Mock chart data
    // In a real application, you would integrate with a charting library like Chart.js
    function createMockChart() {
        const chartPlaceholder = document.querySelector('.chart-placeholder');
        
        if (chartPlaceholder) {
            // Create a simple mock chart
            const mockChart = document.createElement('div');
            mockChart.style.width = '100%';
            mockChart.style.height = '100%';
            mockChart.style.position = 'relative';
            mockChart.style.background = 'linear-gradient(to right, #f2f3f5 0%, #f2f3f5 100%)';
            
            // Create mock chart bars
            const barCount = 12;
            const barWidth = 100 / barCount - 2;
            
            for (let i = 0; i < barCount; i++) {
                const height = Math.random() * 60 + 20;
                const bar = document.createElement('div');
                bar.style.position = 'absolute';
                bar.style.bottom = '0';
                bar.style.left = `${i * (100 / barCount) + 1}%`;
                bar.style.width = `${barWidth}%`;
                bar.style.height = `${height}%`;
                bar.style.backgroundColor = '#5865f2';
                bar.style.borderRadius = '4px 4px 0 0';
                bar.style.opacity = '0.7';
                
                mockChart.appendChild(bar);
            }
            
            // Replace placeholder text with mock chart
            chartPlaceholder.innerHTML = '';
            chartPlaceholder.appendChild(mockChart);
        }
    }
    
    // Initialize mock chart
    createMockChart();
    
    // Search functionality
    const searchInput = document.querySelector('.search input');
    
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            // Here you would add code to filter content based on search input
            console.log('Searching for:', this.value);
        });
    }
    
    // Notification click handler
    const notificationBtn = document.querySelector('.btn-notification');
    
    if (notificationBtn) {
        notificationBtn.addEventListener('click', function() {
            // Here you would show a notifications dropdown
            console.log('Notifications clicked');
        });
    }
    
    // Form submission handling
    const form = document.querySelector('.settings-content');
    
    if (form) {
        const saveBtn = form.querySelector('.btn-primary');
        const resetBtn = form.querySelector('.btn-outline');
        
        if (saveBtn) {
            saveBtn.addEventListener('click', function(e) {
                e.preventDefault();
                // Simulate saving settings
                console.log('Settings saved');
                
                // Show a success message
                const message = document.createElement('div');
                message.className = 'success-message';
                message.style.padding = '10px';
                message.style.backgroundColor = 'rgba(87, 242, 135, 0.2)';
                message.style.color = '#57F287';
                message.style.borderRadius = '4px';
                message.style.marginTop = '10px';
                message.textContent = 'Settings saved successfully!';
                
                // Add it after the buttons
                form.appendChild(message);
                
                // Remove it after 3 seconds
                setTimeout(() => {
                    message.remove();
                }, 3000);
            });
        }
        
        if (resetBtn) {
            resetBtn.addEventListener('click', function(e) {
                e.preventDefault();
                // Reset form fields to default values
                console.log('Form reset');
                
                // You would reset input values here
                const inputs = form.querySelectorAll('input, select');
                inputs.forEach(input => {
                    if (input.type === 'checkbox') {
                        input.checked = input.defaultChecked;
                    } else {
                        input.value = input.defaultValue;
                    }
                });
            });
        }
    }
    
    // Export logs functionality
    const exportBtn = document.querySelector('.logs .btn-outline');
    
    if (exportBtn) {
        exportBtn.addEventListener('click', function() {
            // Simulate exporting logs
            console.log('Exporting logs');
            alert('Logs exported successfully!');
        });
    }
    
    // Filter logs functionality
    const logsSelect = document.querySelector('.logs select');
    
    if (logsSelect) {
        logsSelect.addEventListener('change', function() {
            const selectedValue = this.value;
            console.log('Filtering logs by:', selectedValue);
            
            // You would filter logs here based on the selected value
            const logEntries = document.querySelectorAll('.log-entry');
            
            logEntries.forEach(entry => {
                if (selectedValue === 'All Logs') {
                    entry.style.display = 'flex';
                } else {
                    const logLevel = entry.querySelector('.log-level').textContent;
                    if (logLevel.toLowerCase() === selectedValue.toLowerCase()) {
                        entry.style.display = 'flex';
                    } else {
                        entry.style.display = 'none';
                    }
                }
            });
        });
    }
    
    // Responsive adjustments
    function checkScreenSize() {
        if (window.innerWidth <= 768) {
            sidebar.classList.add('collapsed');
            sidebar.style.width = '70px';
            
            document.querySelectorAll('.sidebar .logo span, .sidebar-menu li span, .sidebar-footer .info')
                .forEach(el => el.style.display = 'none');
            
            document.querySelectorAll('.sidebar-menu li')
                .forEach(el => {
                    el.style.justifyContent = 'center';
                    el.querySelector('i').style.marginRight = '0';
                });
        } else if (!sidebar.classList.contains('collapsed')) {
            sidebar.style.width = '250px';
            
            document.querySelectorAll('.sidebar .logo span, .sidebar-menu li span, .sidebar-footer .info')
                .forEach(el => el.style.display = 'block');
            
            document.querySelectorAll('.sidebar-menu li')
                .forEach(el => {
                    el.style.justifyContent = 'flex-start';
                    el.querySelector('i').style.marginRight = '12px';
                });
        }
    }
    
    // Initial check and event listener for window resize
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
});
