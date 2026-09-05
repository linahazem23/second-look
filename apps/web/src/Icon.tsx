const PATHS: Record<string, string> = {
  flask: '<path d="M9 3h6"/><path d="M10 3v6l-5.5 9a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9V3"/>',
  lipstick: '<path d="M7 14h10v6a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-6Z"/><path d="M8 14 9 4h6l1 10"/>',
  dress: '<path d="M9 3h6l1 4-3 2 4 12H7l4-12-3-2 1-4Z"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  arrowLeft: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  menu: '<line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>',
  close: '<line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/>',
  home: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9h12v-9"/>',
  want: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z"/>',
  demand: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  explore: '<circle cx="12" cy="10" r="3"/><path d="M12 21s7-6.5 7-11.5A7 7 0 0 0 5 9.5C5 14.5 12 21 12 21Z"/>',
  chat: '<path d="M21 12a8 8 0 1 1-3.2-6.4"/>',
  send: '<path d="M4 11 20 4l-6 16-3-7-7-2Z"/>',
  flag: '<path d="M5 3v18"/><path d="M5 4h11l-2 4 2 4H5"/>'
};

export function Icon({ name, size = 20 }: { name: keyof typeof PATHS; size?: number }) {
  return (
    <svg className="icon" style={{ width: size, height: size }} viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: PATHS[name] ?? '' }} />
  );
}

export function categoryIcon(category: string) {
  if (category === 'Skincare') return 'flask';
  if (category === 'Makeup') return 'lipstick';
  return 'dress';
}
