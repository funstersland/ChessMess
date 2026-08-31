export const SAMPLE_HUMAN = {
  id: "human",
  name: "Club game — messy",
  blurb: "Hangs a queen, misses recaptures. A human afternoon.",
  color: "white" as const,
  rating: 1100,
  pgn: `[Event "Club night"]
[White "Club player"]
[Black "Friend"]
[Result "0-1"]
[Variant "Standard"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 h5 4. d4 Qf6 5. Bg5 Qg6 6. Nxe5 Qxg5
7. Nxf7 Qxg2 8. Rf1 Qxe4+ 9. Qe2 Qxe2+ 10. Kxe2 Nxd4+ 11. Kd1 Nxc2
12. Nxh8 Nxa1 13. Bf7+ Kd8 14. Ng6 Nf6 15. Ne5 d6 16. Nf3 Bg4
17. Be6 Bxe6 18. Ng5 Bd5 19. Nc3 Nc2 20. Nxd5 Nxd5 0-1
`,
};

export const SAMPLE_ENGINE = {
  id: "engine",
  name: "Silent accuracy",
  blurb: "Quiet Berlin endgame. Almost no second-best moves.",
  color: "white" as const,
  rating: 1450,
  pgn: `[Event "Rated rapid"]
[White "Accused"]
[Black "Opponent"]
[Result "1/2-1/2"]
[Variant "Standard"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. O-O Nxe4 5. d4 Nd6 6. Bxc6 dxc6
7. dxe5 Nf5 8. Qxd8+ Kxd8 9. Nc3 Ke8 10. h3 h5 11. Bf4 Be7 12. Rad1 Be6
13. Ng5 Rh6 14. Rfe1 Bb4 15. g4 hxg4 16. hxg4 Ne7 17. Nxe6 Rxe6
18. Kg2 Bxc3 19. bxc3 Nd5 20. Bg3 Rd8 21. Rd3 a5 22. a4 b6 23. f3 c5
24. c4 Nb4 25. Rd2 Nc6 26. Red1 Rxd2+ 27. Rxd2 Nd4 28. c3 Nc6
29. Kf2 f6 30. exf6 gxf6 1/2-1/2
`,
};

export const SAMPLES = [SAMPLE_HUMAN, SAMPLE_ENGINE] as const;
