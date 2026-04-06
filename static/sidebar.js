/**
 * Sidebar Toggle & Layout Synchronization
 */
document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const dashboard = document.querySelector('.admin-dashboard');
    const toggleBtn = document.getElementById('sidebarToggle');

    if (!sidebar || !dashboard || !toggleBtn) return;

    // Load persisted state
    const isCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
    if (isCollapsed) {
        dashboard.classList.add('sidebar-collapsed');
    }

    // Toggle Handler
    toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const newState = !dashboard.classList.contains('sidebar-collapsed');

        dashboard.classList.toggle('sidebar-collapsed', newState);
        localStorage.setItem('sidebar-collapsed', newState);

        // Dispatch custom event for modules that might need to resize (e.g. Charts)
        window.dispatchEvent(new Event('sidebarToggled'));
    });
});
