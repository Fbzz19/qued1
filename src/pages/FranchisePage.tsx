import { useEffect, useState, useRef } from 'react';
import { ArrowLeft, Check, Bookmark, Film, Tv } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { tmdb, posterUrl } from '../lib/tmdb';
import { useAuth } from '../context/AuthContext';

interface FranchisePageProps {
  franchiseId: string;
  onBack: () => void;
  onMediaClick: (id: number, type: 'movie' | 'tv') => void;
}

interface FranchiseEntry {
  id: number;
  title: string;
  year: number;
  type: 'movie' | 'tv';
}

interface Franchise {
  id: string;
  name: string;
  description: string;
  color: string;
  entries: FranchiseEntry[];
  chronological?: FranchiseEntry[];
}

const FRANCHISES: Record<string, Franchise> = {
  marvel: {
    id: 'marvel',
    name: 'Marvel Cinematic Universe',
    description: 'The complete MCU in release and chronological order',
    color: '#e31836',
    entries: [
      { id: 1726,   title: 'Iron Man',                                          year: 2008, type: 'movie' },
      { id: 1724,   title: 'The Incredible Hulk',                               year: 2008, type: 'movie' },
      { id: 10138,  title: 'Iron Man 2',                                         year: 2010, type: 'movie' },
      { id: 10195,  title: 'Thor',                                               year: 2011, type: 'movie' },
      { id: 1771,   title: 'Captain America: The First Avenger',                 year: 2011, type: 'movie' },
      { id: 24428,  title: 'The Avengers',                                       year: 2012, type: 'movie' },
      { id: 68721,  title: 'Iron Man 3',                                         year: 2013, type: 'movie' },
      { id: 76338,  title: 'Thor: The Dark World',                               year: 2013, type: 'movie' },
      { id: 100402, title: 'Captain America: The Winter Soldier',                year: 2014, type: 'movie' },
      { id: 118340, title: 'Guardians of the Galaxy',                            year: 2014, type: 'movie' },
      { id: 99861,  title: 'Avengers: Age of Ultron',                            year: 2015, type: 'movie' },
      { id: 286217, title: 'Ant-Man',                                            year: 2015, type: 'movie' },
      { id: 271110, title: 'Captain America: Civil War',                         year: 2016, type: 'movie' },
      { id: 284052, title: 'Doctor Strange',                                     year: 2016, type: 'movie' },
      { id: 283995, title: 'Guardians of the Galaxy Vol. 2',                     year: 2017, type: 'movie' },
      { id: 315635, title: 'Spider-Man: Homecoming',                             year: 2017, type: 'movie' },
      { id: 284053, title: 'Thor: Ragnarok',                                     year: 2017, type: 'movie' },
      { id: 284054, title: 'Black Panther',                                      year: 2018, type: 'movie' },
      { id: 299536, title: 'Avengers: Infinity War',                             year: 2018, type: 'movie' },
      { id: 363088, title: 'Ant-Man and the Wasp',                               year: 2018, type: 'movie' },
      { id: 299537, title: 'Captain Marvel',                                     year: 2019, type: 'movie' },
      { id: 299534, title: 'Avengers: Endgame',                                  year: 2019, type: 'movie' },
      { id: 429617, title: 'Spider-Man: Far From Home',                          year: 2019, type: 'movie' },
      { id: 85271,  title: 'WandaVision',                                        year: 2021, type: 'tv'    },
      { id: 88396,  title: 'The Falcon and the Winter Soldier',                  year: 2021, type: 'tv'    },
      { id: 84958,  title: 'Loki',                                               year: 2021, type: 'tv'    },
      { id: 566525, title: 'Shang-Chi and the Legend of the Ten Rings',          year: 2021, type: 'movie' },
      { id: 91363,  title: 'What If...?',                                        year: 2021, type: 'tv'    },
      { id: 616037, title: 'Eternals',                                           year: 2021, type: 'movie' },
      { id: 88329,  title: 'Hawkeye',                                            year: 2021, type: 'tv'    },
      { id: 634649, title: 'Spider-Man: No Way Home',                            year: 2021, type: 'movie' },
      { id: 453395, title: 'Doctor Strange in the Multiverse of Madness',        year: 2022, type: 'movie' },
      { id: 616649, title: 'Thor: Love and Thunder',                             year: 2022, type: 'movie' },
      { id: 92782,  title: 'Ms. Marvel',                                         year: 2022, type: 'tv'    },
      { id: 505642, title: 'Black Panther: Wakanda Forever',                     year: 2022, type: 'movie' },
      { id: 640146, title: 'Ant-Man and the Wasp: Quantumania',                  year: 2023, type: 'movie' },
      { id: 447365, title: 'Guardians of the Galaxy Vol. 3',                     year: 2023, type: 'movie' },
      { id: 114472, title: 'Secret Invasion',                                    year: 2023, type: 'tv'    },
      { id: 609681, title: 'The Marvels',                                        year: 2023, type: 'movie' },
      { id: 122226, title: 'Echo',                                               year: 2024, type: 'tv'    },
      { id: 533535, title: 'Deadpool & Wolverine',                               year: 2024, type: 'movie' },
      { id: 138501, title: 'Agatha All Along',                                   year: 2024, type: 'tv'    },
    ],
    chronological: [
      { id: 1771,   title: 'Captain America: The First Avenger',                 year: 2011, type: 'movie' },
      { id: 299537, title: 'Captain Marvel',                                     year: 2019, type: 'movie' },
      { id: 1726,   title: 'Iron Man',                                           year: 2008, type: 'movie' },
      { id: 1724,   title: 'The Incredible Hulk',                                year: 2008, type: 'movie' },
      { id: 10138,  title: 'Iron Man 2',                                         year: 2010, type: 'movie' },
      { id: 10195,  title: 'Thor',                                               year: 2011, type: 'movie' },
      { id: 24428,  title: 'The Avengers',                                       year: 2012, type: 'movie' },
      { id: 68721,  title: 'Iron Man 3',                                         year: 2013, type: 'movie' },
      { id: 76338,  title: 'Thor: The Dark World',                               year: 2013, type: 'movie' },
      { id: 100402, title: 'Captain America: The Winter Soldier',                year: 2014, type: 'movie' },
      { id: 118340, title: 'Guardians of the Galaxy',                            year: 2014, type: 'movie' },
      { id: 283995, title: 'Guardians of the Galaxy Vol. 2',                     year: 2017, type: 'movie' },
      { id: 99861,  title: 'Avengers: Age of Ultron',                            year: 2015, type: 'movie' },
      { id: 286217, title: 'Ant-Man',                                            year: 2015, type: 'movie' },
      { id: 271110, title: 'Captain America: Civil War',                         year: 2016, type: 'movie' },
      { id: 284052, title: 'Doctor Strange',                                     year: 2016, type: 'movie' },
      { id: 315635, title: 'Spider-Man: Homecoming',                             year: 2017, type: 'movie' },
      { id: 284053, title: 'Thor: Ragnarok',                                     year: 2017, type: 'movie' },
      { id: 284054, title: 'Black Panther',                                      year: 2018, type: 'movie' },
      { id: 299536, title: 'Avengers: Infinity War',                             year: 2018, type: 'movie' },
      { id: 363088, title: 'Ant-Man and the Wasp',                               year: 2018, type: 'movie' },
      { id: 299534, title: 'Avengers: Endgame',                                  year: 2019, type: 'movie' },
      { id: 429617, title: 'Spider-Man: Far From Home',                          year: 2019, type: 'movie' },
      { id: 85271,  title: 'WandaVision',                                        year: 2021, type: 'tv'    },
      { id: 88396,  title: 'The Falcon and the Winter Soldier',                  year: 2021, type: 'tv'    },
      { id: 84958,  title: 'Loki',                                               year: 2021, type: 'tv'    },
      { id: 566525, title: 'Shang-Chi and the Legend of the Ten Rings',          year: 2021, type: 'movie' },
      { id: 91363,  title: 'What If...?',                                        year: 2021, type: 'tv'    },
      { id: 616037, title: 'Eternals',                                           year: 2021, type: 'movie' },
      { id: 88329,  title: 'Hawkeye',                                            year: 2021, type: 'tv'    },
      { id: 634649, title: 'Spider-Man: No Way Home',                            year: 2021, type: 'movie' },
      { id: 453395, title: 'Doctor Strange in the Multiverse of Madness',        year: 2022, type: 'movie' },
      { id: 616649, title: 'Thor: Love and Thunder',                             year: 2022, type: 'movie' },
      { id: 92782,  title: 'Ms. Marvel',                                         year: 2022, type: 'tv'    },
      { id: 505642, title: 'Black Panther: Wakanda Forever',                     year: 2022, type: 'movie' },
      { id: 640146, title: 'Ant-Man and the Wasp: Quantumania',                  year: 2023, type: 'movie' },
      { id: 447365, title: 'Guardians of the Galaxy Vol. 3',                     year: 2023, type: 'movie' },
      { id: 114472, title: 'Secret Invasion',                                    year: 2023, type: 'tv'    },
      { id: 609681, title: 'The Marvels',                                        year: 2023, type: 'movie' },
      { id: 122226, title: 'Echo',                                               year: 2024, type: 'tv'    },
      { id: 533535, title: 'Deadpool & Wolverine',                               year: 2024, type: 'movie' },
      { id: 138501, title: 'Agatha All Along',                                   year: 2024, type: 'tv'    },
    ],
  },
  star_wars: {
    id: 'star_wars',
    name: 'Star Wars',
    description: 'A galaxy far, far away — in order',
    color: '#ffe81f',
    entries: [
      { id: 11,     title: 'Star Wars: A New Hope',               year: 1977, type: 'movie' },
      { id: 1891,   title: 'The Empire Strikes Back',             year: 1980, type: 'movie' },
      { id: 1892,   title: 'Return of the Jedi',                  year: 1983, type: 'movie' },
      { id: 1893,   title: 'Star Wars: The Phantom Menace',       year: 1999, type: 'movie' },
      { id: 1894,   title: 'Star Wars: Attack of the Clones',     year: 2002, type: 'movie' },
      { id: 1895,   title: 'Star Wars: Revenge of the Sith',      year: 2005, type: 'movie' },
      { id: 140607, title: 'Star Wars: The Force Awakens',        year: 2015, type: 'movie' },
      { id: 330459, title: 'Rogue One: A Star Wars Story',        year: 2016, type: 'movie' },
      { id: 181808, title: 'Star Wars: The Last Jedi',            year: 2017, type: 'movie' },
      { id: 348350, title: 'Solo: A Star Wars Story',             year: 2018, type: 'movie' },
      { id: 181812, title: 'Star Wars: The Rise of Skywalker',    year: 2019, type: 'movie' },
      { id: 82856,  title: 'The Mandalorian',                     year: 2019, type: 'tv'    },
      { id: 115036, title: 'The Book of Boba Fett',               year: 2021, type: 'tv'    },
      { id: 92830,  title: 'Obi-Wan Kenobi',                      year: 2022, type: 'tv'    },
      { id: 83867,  title: 'Andor',                               year: 2022, type: 'tv'    },
      { id: 114461, title: 'Ahsoka',                              year: 2023, type: 'tv'    },
    ],
    chronological: [
      { id: 1893,   title: 'Star Wars: The Phantom Menace',       year: 1999, type: 'movie' },
      { id: 1894,   title: 'Star Wars: Attack of the Clones',     year: 2002, type: 'movie' },
      { id: 1895,   title: 'Star Wars: Revenge of the Sith',      year: 2005, type: 'movie' },
      { id: 348350, title: 'Solo: A Star Wars Story',             year: 2018, type: 'movie' },
      { id: 83867,  title: 'Andor',                               year: 2022, type: 'tv'    },
      { id: 330459, title: 'Rogue One: A Star Wars Story',        year: 2016, type: 'movie' },
      { id: 11,     title: 'Star Wars: A New Hope',               year: 1977, type: 'movie' },
      { id: 1891,   title: 'The Empire Strikes Back',             year: 1980, type: 'movie' },
      { id: 1892,   title: 'Return of the Jedi',                  year: 1983, type: 'movie' },
      { id: 82856,  title: 'The Mandalorian',                     year: 2019, type: 'tv'    },
      { id: 115036, title: 'The Book of Boba Fett',               year: 2021, type: 'tv'    },
      { id: 92830,  title: 'Obi-Wan Kenobi',                      year: 2022, type: 'tv'    },
      { id: 114461, title: 'Ahsoka',                              year: 2023, type: 'tv'    },
      { id: 140607, title: 'Star Wars: The Force Awakens',        year: 2015, type: 'movie' },
      { id: 181808, title: 'Star Wars: The Last Jedi',            year: 2017, type: 'movie' },
      { id: 181812, title: 'Star Wars: The Rise of Skywalker',    year: 2019, type: 'movie' },
    ],
  },
  dc: {
    id: 'dc',
    name: 'DC Extended Universe',
    description: 'The complete DCEU in order',
    color: '#0476f2',
    entries: [
      { id: 49521,  title: 'Man of Steel',                        year: 2013, type: 'movie' },
      { id: 209112, title: 'Batman v Superman: Dawn of Justice',  year: 2016, type: 'movie' },
      { id: 297761, title: 'Suicide Squad',                       year: 2016, type: 'movie' },
      { id: 297762, title: 'Wonder Woman',                        year: 2017, type: 'movie' },
      { id: 328111, title: 'Justice League',                      year: 2017, type: 'movie' },
      { id: 297802, title: 'Aquaman',                             year: 2018, type: 'movie' },
      { id: 287947, title: 'Shazam!',                             year: 2019, type: 'movie' },
      { id: 383498, title: 'Joker',                               year: 2019, type: 'movie' },
      { id: 567189, title: 'Birds of Prey',                       year: 2020, type: 'movie' },
      { id: 464052, title: 'Wonder Woman 1984',                   year: 2020, type: 'movie' },
      { id: 436969, title: 'The Suicide Squad',                   year: 2021, type: 'movie' },
      { id: 110492, title: 'Peacemaker',                          year: 2022, type: 'tv'    },
      { id: 775996, title: 'The Batman',                          year: 2022, type: 'movie' },
      { id: 533514, title: 'Black Adam',                          year: 2022, type: 'movie' },
      { id: 594767, title: 'Shazam! Fury of the Gods',            year: 2023, type: 'movie' },
      { id: 298618, title: 'The Flash',                           year: 2023, type: 'movie' },
      { id: 565770, title: 'Blue Beetle',                         year: 2023, type: 'movie' },
      { id: 526896, title: 'Aquaman and the Lost Kingdom',        year: 2023, type: 'movie' },
    ],
  },
  john_wick: {
    id: 'john_wick',
    name: 'John Wick',
    description: 'Be afraid of the man who killed three men with a pencil',
    color: '#fbbf24',
    entries: [
      { id: 245891, title: 'John Wick',                           year: 2014, type: 'movie' },
      { id: 484717, title: 'John Wick: Chapter 2',                year: 2017, type: 'movie' },
      { id: 458156, title: 'John Wick: Chapter 3 – Parabellum',   year: 2019, type: 'movie' },
      { id: 603692, title: 'John Wick: Chapter 4',                year: 2023, type: 'movie' },
    ],
  },
  jurassic_park: {
    id: 'jurassic_park',
    name: 'Jurassic Park',
    description: 'Life finds a way — the complete dinosaur saga',
    color: '#84cc16',
    entries: [
      { id: 329,    title: 'Jurassic Park',                       year: 1993, type: 'movie' },
      { id: 330,    title: 'The Lost World: Jurassic Park',        year: 1997, type: 'movie' },
      { id: 331,    title: 'Jurassic Park III',                    year: 2001, type: 'movie' },
      { id: 135397, title: 'Jurassic World',                      year: 2015, type: 'movie' },
      { id: 351286, title: 'Jurassic World: Fallen Kingdom',      year: 2018, type: 'movie' },
      { id: 507086, title: 'Jurassic World Dominion',             year: 2022, type: 'movie' },
    ],
  },
  indiana_jones: {
    id: 'indiana_jones',
    name: 'Indiana Jones',
    description: 'Adventure has a name — the complete Indiana Jones saga',
    color: '#d97706',
    entries: [
      { id: 85,     title: 'Raiders of the Lost Ark',                             year: 1981, type: 'movie' },
      { id: 87,     title: 'Indiana Jones and the Temple of Doom',                year: 1984, type: 'movie' },
      { id: 89,     title: 'Indiana Jones and the Last Crusade',                  year: 1989, type: 'movie' },
      { id: 217,    title: 'Indiana Jones and the Kingdom of the Crystal Skull',  year: 2008, type: 'movie' },
      { id: 335977, title: 'Indiana Jones and the Dial of Destiny',               year: 2023, type: 'movie' },
    ],
    chronological: [
      { id: 87,     title: 'Indiana Jones and the Temple of Doom',                year: 1984, type: 'movie' },
      { id: 85,     title: 'Raiders of the Lost Ark',                             year: 1981, type: 'movie' },
      { id: 89,     title: 'Indiana Jones and the Last Crusade',                  year: 1989, type: 'movie' },
      { id: 217,    title: 'Indiana Jones and the Kingdom of the Crystal Skull',  year: 2008, type: 'movie' },
      { id: 335977, title: 'Indiana Jones and the Dial of Destiny',               year: 2023, type: 'movie' },
    ],
  },
  alien: {
    id: 'alien',
    name: 'Alien',
    description: 'In space, no one can hear you scream — the complete saga',
    color: '#22c55e',
    entries: [
      { id: 348,    title: 'Alien',                               year: 1979, type: 'movie' },
      { id: 679,    title: 'Aliens',                              year: 1986, type: 'movie' },
      { id: 8077,   title: 'Alien 3',                             year: 1992, type: 'movie' },
      { id: 8078,   title: 'Alien Resurrection',                  year: 1997, type: 'movie' },
      { id: 70981,  title: 'Prometheus',                          year: 2012, type: 'movie' },
      { id: 198663, title: 'Alien: Covenant',                     year: 2017, type: 'movie' },
      { id: 945961, title: 'Alien: Romulus',                      year: 2024, type: 'movie' },
    ],
    chronological: [
      { id: 70981,  title: 'Prometheus',                          year: 2012, type: 'movie' },
      { id: 198663, title: 'Alien: Covenant',                     year: 2017, type: 'movie' },
      { id: 348,    title: 'Alien',                               year: 1979, type: 'movie' },
      { id: 945961, title: 'Alien: Romulus',                      year: 2024, type: 'movie' },
      { id: 679,    title: 'Aliens',                              year: 1986, type: 'movie' },
      { id: 8077,   title: 'Alien 3',                             year: 1992, type: 'movie' },
      { id: 8078,   title: 'Alien Resurrection',                  year: 1997, type: 'movie' },
    ],
  },
  terminator: {
    id: 'terminator',
    name: 'Terminator',
    description: "I'll be back — the complete Terminator saga",
    color: '#ef4444',
    entries: [
      { id: 218,    title: 'The Terminator',                      year: 1984, type: 'movie' },
      { id: 280,    title: 'Terminator 2: Judgment Day',          year: 1991, type: 'movie' },
      { id: 296,    title: 'Terminator 3: Rise of the Machines',  year: 2003, type: 'movie' },
      { id: 534,    title: 'Terminator Salvation',                year: 2009, type: 'movie' },
      { id: 87101,  title: 'Terminator Genisys',                  year: 2015, type: 'movie' },
      { id: 441130, title: 'Terminator: Dark Fate',               year: 2019, type: 'movie' },
    ],
  },
  transformers: {
    id: 'transformers',
    name: 'Transformers',
    description: 'More than meets the eye — the complete Transformers saga',
    color: '#f59e0b',
    entries: [
      { id: 1858,   title: 'Transformers',                        year: 2007, type: 'movie' },
      { id: 8373,   title: 'Transformers: Revenge of the Fallen', year: 2009, type: 'movie' },
      { id: 38356,  title: 'Transformers: Dark of the Moon',      year: 2011, type: 'movie' },
      { id: 91314,  title: 'Transformers: Age of Extinction',     year: 2014, type: 'movie' },
      { id: 335988, title: 'Transformers: The Last Knight',       year: 2017, type: 'movie' },
      { id: 424783, title: 'Bumblebee',                           year: 2018, type: 'movie' },
      { id: 667538, title: 'Transformers: Rise of the Beasts',    year: 2023, type: 'movie' },
    ],
  },
  mission_impossible: {
    id: 'mission_impossible',
    name: 'Mission: Impossible',
    description: 'Your mission, should you choose to accept it...',
    color: '#60a5fa',
    entries: [
      { id: 954,    title: 'Mission: Impossible',                 year: 1996, type: 'movie' },
      { id: 955,    title: 'Mission: Impossible 2',               year: 2000, type: 'movie' },
      { id: 956,    title: 'Mission: Impossible III',             year: 2006, type: 'movie' },
      { id: 56292,  title: 'Mission: Impossible – Ghost Protocol', year: 2011, type: 'movie' },
      { id: 177677, title: 'Mission: Impossible – Rogue Nation',  year: 2015, type: 'movie' },
      { id: 353081, title: 'Mission: Impossible – Fallout',       year: 2018, type: 'movie' },
      { id: 575264, title: 'Mission: Impossible – Dead Reckoning Part One', year: 2023, type: 'movie' },
    ],
  },
  harry_potter: {
    id: 'harry_potter',
    name: 'Harry Potter',
    description: 'The complete Harry Potter and Fantastic Beasts saga',
    color: '#a16207',
    entries: [
      { id: 671,    title: "Harry Potter and the Philosopher's Stone",          year: 2001, type: 'movie' },
      { id: 672,    title: 'Harry Potter and the Chamber of Secrets',           year: 2002, type: 'movie' },
      { id: 673,    title: 'Harry Potter and the Prisoner of Azkaban',          year: 2004, type: 'movie' },
      { id: 674,    title: 'Harry Potter and the Goblet of Fire',               year: 2005, type: 'movie' },
      { id: 675,    title: 'Harry Potter and the Order of the Phoenix',         year: 2007, type: 'movie' },
      { id: 767,    title: 'Harry Potter and the Half-Blood Prince',            year: 2009, type: 'movie' },
      { id: 12444,  title: 'Harry Potter and the Deathly Hallows – Part 1',    year: 2010, type: 'movie' },
      { id: 12445,  title: 'Harry Potter and the Deathly Hallows – Part 2',    year: 2011, type: 'movie' },
      { id: 259693, title: 'Fantastic Beasts and Where to Find Them',          year: 2016, type: 'movie' },
      { id: 338952, title: 'Fantastic Beasts: The Crimes of Grindelwald',      year: 2018, type: 'movie' },
      { id: 594254, title: 'Fantastic Beasts: The Secrets of Dumbledore',      year: 2022, type: 'movie' },
    ],
    chronological: [
      { id: 259693, title: 'Fantastic Beasts and Where to Find Them',          year: 2016, type: 'movie' },
      { id: 338952, title: 'Fantastic Beasts: The Crimes of Grindelwald',      year: 2018, type: 'movie' },
      { id: 594254, title: 'Fantastic Beasts: The Secrets of Dumbledore',      year: 2022, type: 'movie' },
      { id: 671,    title: "Harry Potter and the Philosopher's Stone",          year: 2001, type: 'movie' },
      { id: 672,    title: 'Harry Potter and the Chamber of Secrets',           year: 2002, type: 'movie' },
      { id: 673,    title: 'Harry Potter and the Prisoner of Azkaban',          year: 2004, type: 'movie' },
      { id: 674,    title: 'Harry Potter and the Goblet of Fire',               year: 2005, type: 'movie' },
      { id: 675,    title: 'Harry Potter and the Order of the Phoenix',         year: 2007, type: 'movie' },
      { id: 767,    title: 'Harry Potter and the Half-Blood Prince',            year: 2009, type: 'movie' },
      { id: 12444,  title: 'Harry Potter and the Deathly Hallows – Part 1',    year: 2010, type: 'movie' },
      { id: 12445,  title: 'Harry Potter and the Deathly Hallows – Part 2',    year: 2011, type: 'movie' },
    ],
  },
  lotr: {
    id: 'lotr',
    name: 'Lord of the Rings',
    description: 'The Lord of the Rings and The Hobbit trilogies',
    color: '#78350f',
    entries: [
      { id: 120,    title: 'The Lord of the Rings: The Fellowship of the Ring', year: 2001, type: 'movie' },
      { id: 121,    title: 'The Lord of the Rings: The Two Towers',             year: 2002, type: 'movie' },
      { id: 122,    title: 'The Lord of the Rings: The Return of the King',     year: 2003, type: 'movie' },
      { id: 49051,  title: 'The Hobbit: An Unexpected Journey',                 year: 2012, type: 'movie' },
      { id: 57158,  title: 'The Hobbit: The Desolation of Smaug',               year: 2013, type: 'movie' },
      { id: 122917, title: 'The Hobbit: The Battle of the Five Armies',         year: 2014, type: 'movie' },
    ],
    chronological: [
      { id: 49051,  title: 'The Hobbit: An Unexpected Journey',                 year: 2012, type: 'movie' },
      { id: 57158,  title: 'The Hobbit: The Desolation of Smaug',               year: 2013, type: 'movie' },
      { id: 122917, title: 'The Hobbit: The Battle of the Five Armies',         year: 2014, type: 'movie' },
      { id: 120,    title: 'The Lord of the Rings: The Fellowship of the Ring', year: 2001, type: 'movie' },
      { id: 121,    title: 'The Lord of the Rings: The Two Towers',             year: 2002, type: 'movie' },
      { id: 122,    title: 'The Lord of the Rings: The Return of the King',     year: 2003, type: 'movie' },
    ],
  },
  fast_furious: {
    id: 'fast_furious',
    name: 'Fast & Furious',
    description: 'The complete Fast & Furious saga — family, speed, and chaos',
    color: '#f97316',
    entries: [
      { id: 9799,   title: 'The Fast and the Furious',            year: 2001, type: 'movie' },
      { id: 584,    title: '2 Fast 2 Furious',                    year: 2003, type: 'movie' },
      { id: 9615,   title: 'The Fast and the Furious: Tokyo Drift', year: 2006, type: 'movie' },
      { id: 13804,  title: 'Fast & Furious',                      year: 2009, type: 'movie' },
      { id: 51497,  title: 'Fast Five',                           year: 2011, type: 'movie' },
      { id: 82992,  title: 'Fast & Furious 6',                    year: 2013, type: 'movie' },
      { id: 168259, title: 'Furious 7',                           year: 2015, type: 'movie' },
      { id: 337339, title: 'The Fate of the Furious',             year: 2017, type: 'movie' },
      { id: 384018, title: 'Fast & Furious Presents: Hobbs & Shaw', year: 2019, type: 'movie' },
      { id: 561213, title: 'F9: The Fast Saga',                   year: 2021, type: 'movie' },
      { id: 385687, title: 'Fast X',                              year: 2023, type: 'movie' },
    ],
    chronological: [
      { id: 9799,   title: 'The Fast and the Furious',            year: 2001, type: 'movie' },
      { id: 584,    title: '2 Fast 2 Furious',                    year: 2003, type: 'movie' },
      { id: 13804,  title: 'Fast & Furious',                      year: 2009, type: 'movie' },
      { id: 51497,  title: 'Fast Five',                           year: 2011, type: 'movie' },
      { id: 82992,  title: 'Fast & Furious 6',                    year: 2013, type: 'movie' },
      { id: 9615,   title: 'The Fast and the Furious: Tokyo Drift', year: 2006, type: 'movie' },
      { id: 168259, title: 'Furious 7',                           year: 2015, type: 'movie' },
      { id: 337339, title: 'The Fate of the Furious',             year: 2017, type: 'movie' },
      { id: 384018, title: 'Fast & Furious Presents: Hobbs & Shaw', year: 2019, type: 'movie' },
      { id: 561213, title: 'F9: The Fast Saga',                   year: 2021, type: 'movie' },
      { id: 385687, title: 'Fast X',                              year: 2023, type: 'movie' },
    ],
  },
  james_bond: {
    id: 'james_bond',
    name: 'James Bond',
    description: 'The complete 007 saga — shaken, not stirred',
    color: '#64748b',
    entries: [
      { id: 253,    title: 'Dr. No',                              year: 1962, type: 'movie' },
      { id: 254,    title: 'From Russia with Love',               year: 1963, type: 'movie' },
      { id: 255,    title: 'Goldfinger',                          year: 1964, type: 'movie' },
      { id: 844,    title: 'Thunderball',                         year: 1965, type: 'movie' },
      { id: 10220,  title: 'You Only Live Twice',                 year: 1967, type: 'movie' },
      { id: 686,    title: "On Her Majesty's Secret Service",     year: 1969, type: 'movie' },
      { id: 697,    title: 'Diamonds Are Forever',                year: 1971, type: 'movie' },
      { id: 698,    title: 'Live and Let Die',                    year: 1973, type: 'movie' },
      { id: 699,    title: 'The Man with the Golden Gun',         year: 1974, type: 'movie' },
      { id: 700,    title: 'The Spy Who Loved Me',                year: 1977, type: 'movie' },
      { id: 701,    title: 'Moonraker',                           year: 1979, type: 'movie' },
      { id: 702,    title: 'For Your Eyes Only',                  year: 1981, type: 'movie' },
      { id: 703,    title: 'Octopussy',                           year: 1983, type: 'movie' },
      { id: 704,    title: 'A View to a Kill',                    year: 1985, type: 'movie' },
      { id: 708,    title: 'The Living Daylights',                year: 1987, type: 'movie' },
      { id: 709,    title: 'Licence to Kill',                     year: 1989, type: 'movie' },
      { id: 710,    title: 'GoldenEye',                           year: 1995, type: 'movie' },
      { id: 714,    title: 'Tomorrow Never Dies',                 year: 1997, type: 'movie' },
      { id: 715,    title: 'The World Is Not Enough',             year: 1999, type: 'movie' },
      { id: 716,    title: 'Die Another Day',                     year: 2002, type: 'movie' },
      { id: 36557,  title: 'Casino Royale',                       year: 2006, type: 'movie' },
      { id: 10764,  title: 'Quantum of Solace',                   year: 2008, type: 'movie' },
      { id: 37724,  title: 'Skyfall',                             year: 2012, type: 'movie' },
      { id: 206647, title: 'Spectre',                             year: 2015, type: 'movie' },
      { id: 370172, title: 'No Time to Die',                      year: 2021, type: 'movie' },
    ],
  },
};

export const FRANCHISE_LIST = Object.values(FRANCHISES).map(f => ({ id: f.id, name: f.name, color: f.color }));
export const FRANCHISES_DATA = FRANCHISES;

// Batch-fetch posters with concurrency control to avoid rate limiting
async function fetchPostersInBatches(
  entries: FranchiseEntry[],
  batchSize = 6,
  delayMs = 100,
): Promise<Record<string, string | null>> {
  const result: Record<string, string | null> = {};
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async e => {
        const key = `${e.type}-${e.id}`;
        try {
          const data = e.type === 'movie'
            ? await tmdb.movieDetails(e.id)
            : await tmdb.tvDetails(e.id);
          return { key, path: (data.poster_path as string | null) ?? null };
        } catch {
          return { key, path: null };
        }
      })
    );
    results.forEach(r => { result[r.key] = r.path; });
    if (i + batchSize < entries.length && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  return result;
}

export default function FranchisePage({ franchiseId, onBack, onMediaClick }: FranchisePageProps) {
  const { user } = useAuth();
  const franchise = FRANCHISES[franchiseId];
  const [order, setOrder] = useState<'release' | 'chronological'>('release');
  const [typeFilter, setTypeFilter] = useState<'all' | 'movie' | 'tv'>('all');
  const [watchedIds, setWatchedIds] = useState<Set<number>>(new Set());
  const [watchlistIds, setWatchlistIds] = useState<Set<number>>(new Set());
  const [addingAll, setAddingAll] = useState(false);
  // Map from `${type}-${id}` → poster_path (null = no poster, undefined = not yet fetched)
  const [posterMap, setPosterMap] = useState<Record<string, string | null>>({});
  const [postersLoading, setPostersLoading] = useState(true);
  const fetchedFranchiseRef = useRef<string | null>(null);

  const allEntries = order === 'chronological' && franchise?.chronological
    ? franchise.chronological
    : franchise?.entries ?? [];
  const entries = typeFilter === 'all' ? allEntries : allEntries.filter(e => e.type === typeFilter);

  // Fetch ALL posters upfront whenever franchise changes
  useEffect(() => {
    if (!franchise) return;
    if (fetchedFranchiseRef.current === franchiseId) return;
    fetchedFranchiseRef.current = franchiseId;

    setPostersLoading(true);
    setPosterMap({});

    // Deduplicate entries by type+id before fetching
    const seen = new Set<string>();
    const unique = franchise.entries.filter(e => {
      const k = `${e.type}-${e.id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    fetchPostersInBatches(unique).then(map => {
      setPosterMap(map);
      setPostersLoading(false);
    });
  }, [franchiseId, franchise]);

  useEffect(() => {
    if (!user || !franchise) return;
    const ids = franchise.entries.map(e => e.id);
    Promise.all([
      supabase.from('watched').select('tmdb_id').eq('user_id', user.id).in('tmdb_id', ids),
      supabase.from('watchlist').select('tmdb_id').eq('user_id', user.id).in('tmdb_id', ids),
    ]).then(([{ data: w }, { data: wl }]) => {
      setWatchedIds(new Set((w ?? []).map((r: { tmdb_id: number }) => r.tmdb_id)));
      setWatchlistIds(new Set((wl ?? []).map((r: { tmdb_id: number }) => r.tmdb_id)));
    });
  }, [user, franchiseId]);

  async function addAllToWatchlist() {
    if (!user) return;
    setAddingAll(true);
    const unwatched = entries.filter(e => !watchedIds.has(e.id) && !watchlistIds.has(e.id));
    for (const entry of unwatched) {
      const ps = posterMap[`${entry.type}-${entry.id}`] ?? null;
      await supabase.from('watchlist').upsert({
        user_id: user.id, tmdb_id: entry.id, media_type: entry.type,
        title: entry.title, poster_path: ps, added_at: new Date().toISOString(),
      }, { onConflict: 'user_id,tmdb_id,media_type' });
    }
    setWatchlistIds(new Set([...watchlistIds, ...unwatched.map(e => e.id)]));
    setAddingAll(false);
  }

  if (!franchise) {
    return (
      <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#555' }}>Franchise not found.</p>
      </div>
    );
  }

  const totalEntries = franchise.entries.length;
  const watchedCount = franchise.entries.filter(e => watchedIds.has(e.id)).length;
  const progress = totalEntries > 0 ? (watchedCount / totalEntries) * 100 : 0;
  const hasChronological = !!franchise.chronological;
  const hasTV = franchise.entries.some(e => e.type === 'tv');

  return (
    <div style={{ minHeight: '100vh', background: '#000', paddingBottom: 96 }} className="animate-fade-in">
      {/* Sticky header */}
      <div style={{ position: 'sticky', top: 56, zIndex: 10, background: 'rgba(0,0,0,.95)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #1a1a1a', padding: '14px clamp(16px,4vw,48px)', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={onBack}
          style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontFamily: 'inherit', transition: 'color .2s', flexShrink: 0 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={e => (e.currentTarget.style.color = '#888')}>
          <ArrowLeft size={16} />
        </button>
        <h1 style={{ margin: 0, color: '#fff', fontSize: 'clamp(14px,2vw,17px)', fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{franchise.name}</h1>
        {postersLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 12, border: '2px solid #f59e0b', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ color: '#555', fontSize: 11 }}>Loading posters...</span>
          </div>
        )}
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px clamp(16px,4vw,48px) 0' }}>
        {/* Description + progress */}
        <p style={{ margin: '0 0 14px', color: '#888', fontSize: 14 }}>{franchise.description}</p>

        <div style={{ background: '#0d0d0d', borderRadius: 14, border: '1px solid #1a1a1a', padding: '14px 18px', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{watchedCount} / {totalEntries} watched</span>
            <span style={{ color: '#555', fontSize: 12 }}>{Math.round(progress)}%</span>
          </div>
          <div style={{ height: 6, background: '#1a1a1a', borderRadius: 3 }}>
            <div style={{ height: '100%', borderRadius: 3, background: franchise.color, width: `${progress}%`, transition: 'width .4s' }} />
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 24 }}>
          {hasChronological && (
            <div style={{ display: 'flex', background: '#111', borderRadius: 10, padding: 3, gap: 3 }}>
              {(['release', 'chronological'] as const).map(o => (
                <button key={o} onClick={() => setOrder(o)}
                  style={{ padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, fontFamily: 'inherit', transition: 'all .2s',
                    background: order === o ? franchise.color : 'transparent', color: order === o ? '#000' : '#888' }}>
                  {o === 'release' ? 'Release Order' : 'Chronological'}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', background: '#111', borderRadius: 10, padding: 3, gap: 3 }}>
            {([['all', 'All'], ['movie', 'Films'], ['tv', 'Shows']] as const).map(([val, label]) => (
              <button key={val} onClick={() => setTypeFilter(val)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, fontFamily: 'inherit', transition: 'all .2s',
                  background: typeFilter === val ? '#f59e0b' : 'transparent', color: typeFilter === val ? '#000' : '#888',
                  opacity: val === 'tv' && !hasTV ? 0.35 : 1 }}>
                {val === 'movie' && <Film size={11} />}
                {val === 'tv'    && <Tv size={11} />}
                {label}
              </button>
            ))}
          </div>

          {user && (
            <button onClick={addAllToWatchlist} disabled={addingAll}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#111', border: '1px solid #2e2e2e', borderRadius: 10, cursor: 'pointer', fontSize: 12, color: '#ccc', fontFamily: 'inherit', transition: 'border-color .2s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = franchise.color)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#2e2e2e')}>
              <Bookmark size={13} />
              {addingAll ? 'Adding...' : 'Add unwatched to Watchlist'}
            </button>
          )}
        </div>

        {/* Entries grid — always show ALL entries */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(110px,12vw,150px), 1fr))', gap: 16 }}>
          {entries.map((entry, idx) => {
            const key = `${entry.type}-${entry.id}`;
            const posterPath = posterMap[key];
            // posterPath undefined = still loading, null = no poster found, string = valid path
            const ps = posterPath ? posterUrl(posterPath) : null;
            const isWatched = watchedIds.has(entry.id);
            const isWatchlisted = watchlistIds.has(entry.id);
            return (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div
                  style={{ position: 'relative', aspectRatio: '2/3', cursor: 'pointer' }}
                  onClick={() => onMediaClick(entry.id, entry.type)}
                >
                  <div className="poster-card" style={{ position: 'absolute', inset: 0, borderRadius: 10, overflow: 'hidden', background: '#111' }}>
                    {postersLoading && posterPath === undefined ? (
                      // Still loading — show shimmer
                      <div className="shimmer" style={{ width: '100%', height: '100%' }} />
                    ) : ps ? (
                      <img
                        src={ps}
                        alt={entry.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        loading="lazy"
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: '#1a1a1a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 8 }}>
                        {entry.type === 'tv' ? <Tv size={20} color="#555" /> : <Film size={20} color="#555" />}
                        <span style={{ color: '#444', fontSize: 9, textAlign: 'center', lineHeight: 1.3 }}>{entry.title}</span>
                      </div>
                    )}
                  </div>

                  {/* Number badge */}
                  <div style={{ position: 'absolute', top: 6, left: 6, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${franchise.color}40`, zIndex: 1 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: franchise.color }}>{idx + 1}</span>
                  </div>

                  {/* TV badge */}
                  {entry.type === 'tv' && (
                    <div style={{ position: 'absolute', bottom: 6, left: 6, background: 'rgba(0,0,0,.85)', borderRadius: 4, padding: '2px 5px', display: 'flex', alignItems: 'center', gap: 3, zIndex: 1 }}>
                      <Tv size={9} color="#60a5fa" />
                      <span style={{ fontSize: 9, color: '#60a5fa', fontWeight: 600 }}>SHOW</span>
                    </div>
                  )}

                  {/* Watched overlay */}
                  {isWatched && (
                    <div style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', background: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                      <Check size={12} color="#000" strokeWidth={3} />
                    </div>
                  )}
                  {!isWatched && isWatchlisted && (
                    <div style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                      <Bookmark size={11} color="#000" />
                    </div>
                  )}
                </div>

                <div>
                  <p style={{ margin: 0, color: isWatched ? '#4ade80' : '#e0e0e0', fontSize: 11, fontWeight: 500, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{entry.title}</p>
                  <p style={{ margin: '2px 0 0', color: '#555', fontSize: 10 }}>{entry.year}</p>
                </div>
              </div>
            );
          })}
        </div>

        {entries.length === 0 && (
          <p style={{ color: '#555', fontSize: 14, textAlign: 'center', padding: '40px 0' }}>
            No entries match the current filter.
          </p>
        )}
      </div>
    </div>
  );
}
