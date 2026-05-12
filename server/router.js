'use strict';

function parsePattern(pattern) {
  const parts = pattern.split('/');
  return { parts, paramNames: parts.filter(p => p.startsWith(':')).map(p => p.slice(1)) };
}

function matchPath(patternParts, urlParts) {
  if (patternParts.length !== urlParts.length) return null;
  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i];
    const up = urlParts[i];
    if (pp.startsWith(':')) {
      params[pp.slice(1)] = up;
    } else if (pp !== up) {
      return null;
    }
  }
  return params;
}

class Router {
  constructor() {
    this._routes = [];
  }

  on(method, pattern, handler) {
    const { parts } = parsePattern(pattern);
    this._routes.push({ method: method.toUpperCase(), parts, handler });
  }

  dispatch(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const urlParts = url.pathname.split('/');
    const method = req.method.toUpperCase();

    for (const route of this._routes) {
      if (route.method !== method) continue;
      const params = matchPath(route.parts, urlParts);
      if (params !== null) {
        return route.handler(req, res, params);
      }
    }
    return null; // no match
  }
}

module.exports = { Router };
