const routes = {};

export function route(path, handler) {
  routes[path] = handler;
}

export function navigate(path) {
  location.hash = path;
}

export function startRouter(defaultPath = '#/home') {
  window.addEventListener('hashchange', dispatch);
  if (!location.hash) {
    location.hash = defaultPath;
  } else {
    dispatch();
  }
}

function dispatch() {
  const hash = location.hash || '#/home';
  const [path, query] = hash.slice(1).split('?');
  const params = Object.fromEntries(new URLSearchParams(query));
  const handler = routes[path] || routes['/home'];
  window.dispatchEvent(new CustomEvent('routechange', { detail: { path } }));
  handler(params);
}
