const KEY = 'boxfury:name';

export function getUsername() {
  let name = sessionStorage.getItem(KEY);
  if (name === null) {
    name = localStorage.getItem(KEY) ?? '';
    sessionStorage.setItem(KEY, name);
  }
  return name;
}

export function setUsername(name) {
  const clean = String(name ?? '').trim().slice(0, 16);
  if (clean) {
    sessionStorage.setItem(KEY, clean);
    localStorage.setItem(KEY, clean);
  } else {
    sessionStorage.removeItem(KEY);
    localStorage.removeItem(KEY);
  }
}
