const KEY = "chessmess-progress";

type Progress = { lessons: string[]; puzzles: string[] };

function read(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { lessons: [], puzzles: [] };
    const p = JSON.parse(raw) as Progress;
    return {
      lessons: Array.isArray(p.lessons) ? p.lessons : [],
      puzzles: Array.isArray(p.puzzles) ? p.puzzles : [],
    };
  } catch {
    return { lessons: [], puzzles: [] };
  }
}

function write(p: Progress) {
  localStorage.setItem(KEY, JSON.stringify(p));
}

export function isLessonDone(id: string) {
  return read().lessons.includes(id);
}

export function markLessonDone(id: string) {
  const p = read();
  if (!p.lessons.includes(id)) {
    p.lessons.push(id);
    write(p);
  }
}

export function isPuzzleDone(id: string) {
  return read().puzzles.includes(id);
}

export function markPuzzleDone(id: string) {
  const p = read();
  if (!p.puzzles.includes(id)) {
    p.puzzles.push(id);
    write(p);
  }
}

export function puzzleStreak() {
  return read().puzzles.length;
}
