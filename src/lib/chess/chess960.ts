/** Scharnagl’s mapping of Chess960 IDs 0–959 to a starting FEN (X-FEN castling). */
export function chess960Fen(id: number): string {
  const n0 = ((id % 960) + 960) % 960;
  const place = Array<string>(8).fill("");
  let n = n0;

  const lightFile = (n % 4) * 2 + 1;
  n = Math.floor(n / 4);
  const darkFile = (n % 4) * 2;
  n = Math.floor(n / 4);
  place[lightFile] = "b";
  place[darkFile] = "b";

  const empty = () => place.map((p, i) => (p === "" ? i : -1)).filter((i) => i >= 0);

  const qSlots = empty();
  place[qSlots[n % 6]] = "q";
  n = Math.floor(n / 6);

  const nSlots = empty();
  const pairs: [number, number][] = [];
  for (let a = 0; a < nSlots.length; a++) {
    for (let b = a + 1; b < nSlots.length; b++) pairs.push([a, b]);
  }
  const pair = pairs[Math.min(n, pairs.length - 1)]!;
  place[nSlots[pair[0]]] = "n";
  place[nSlots[pair[1]]] = "n";

  const rest = empty();
  place[rest[0]] = "r";
  place[rest[1]] = "k";
  place[rest[2]] = "r";

  const back = place.join("");
  const rookFiles = place
    .map((p, i) => (p === "r" ? "abcdefgh"[i] : ""))
    .filter(Boolean);
  const castle =
    rookFiles[0]!.toUpperCase() +
    rookFiles[1]!.toUpperCase() +
    rookFiles[0] +
    rookFiles[1];
  return `${back}/pppppppp/8/8/8/8/PPPPPPPP/${back.toUpperCase()} w ${castle} - 0 1`;
}

export function random960Id(): number {
  return Math.floor(Math.random() * 960);
}
