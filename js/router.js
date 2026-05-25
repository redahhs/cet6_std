/**
 * Lightweight SPA Router
 */

class Router {
  constructor(routes) {
    this.routes = routes;
    this.currentPage = null;
    this.root = document.getElementById('app');
    
    window.addEventListener('popstate', () => this.resolve());
  }

  navigate(path) {
    history.pushState({ path }, '', path);
    this.resolve();
  }

  resolve() {
    const path = window.location.pathname || '/';
    const route = this.routes.find(r => r.path === path) || this.routes[0];

    // Unmount current page
    if (this.currentPage && this.currentPage.unmount) {
      this.currentPage.unmount();
    }

    // Mount new page
    this.root.innerHTML = ''; // Clear
    this.currentPage = new route.component(this.root);
    if (this.currentPage.mount) {
      this.currentPage.mount();
    }
  }
}

window.Router = Router;