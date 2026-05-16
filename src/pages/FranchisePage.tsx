import { useEffect, useMemo, useState, useRef, type CSSProperties } from 'react';
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
  posterPath?: string;
  releaseDate?: string;
  autoDiscovered?: boolean;
}

interface FranchiseAutoSources {
  movieCollectionIds?: number[];
  excludedMovieCollectionIds?: number[];
}

interface Franchise {
  id: string;
  name: string;
  description: string;
  color: string;
  entries: FranchiseEntry[];
  chronological?: FranchiseEntry[];
  autoSources?: FranchiseAutoSources;
}

const FRANCHISES: Record<string, Franchise> = {
  marvel: {
    id: 'marvel',
    name: 'Marvel Cinematic Universe',
    description: 'The complete MCU in release and chronological order',
    color: '#e31836',
    entries: [
      { id: 1726,   title: 'Iron Man',                                           year: 2008, type: 'movie' },
      { id: 1724,   title: 'The Incredible Hulk',                                year: 2008, type: 'movie' },
      { id: 10138,  title: 'Iron Man 2',                                         year: 2010, type: 'movie' },
      { id: 10195,  title: 'Thor',                                               year: 2011, type: 'movie' },
      { id: 1771,   title: 'Captain America: The First Avenger',                 year: 2011, type: 'movie' },
      { id: 76122,  title: 'Marvel One-Shot: The Consultant',                    year: 2011, type: 'movie', posterPath: '/xqNLXUUvBnfVk6m3QFGGU0Grgs7.jpg' },
      { id: 76535,  title: "Marvel One-Shot: A Funny Thing Happened on the Way to Thor's Hammer", year: 2011, type: 'movie', posterPath: '/ugrdgmZlSuiavH0NFurhlUPIRD0.jpg' },
      { id: 24428,  title: 'The Avengers',                                       year: 2012, type: 'movie' },
      { id: 119569, title: 'Marvel One-Shot: Item 47',                           year: 2012, type: 'movie', posterPath: '/hnSxG8clwLuAXEkp9emc8HCUcHD.jpg' },
      { id: 68721,  title: 'Iron Man 3',                                         year: 2013, type: 'movie' },
      { id: 211387, title: 'Marvel One-Shot: Agent Carter',                      year: 2013, type: 'movie', posterPath: '/4vFKKWPvCVDJTOWiwReBfpAMScP.jpg' },
      { id: 76338,  title: 'Thor: The Dark World',                               year: 2013, type: 'movie' },
      { id: 253980, title: 'Marvel One-Shot: All Hail the King',                 year: 2014, type: 'movie', posterPath: '/y0QYZPWgeGKOvyrzi6Oz3aJPxJa.jpg' },
      { id: 100402, title: 'Captain America: The Winter Soldier',                year: 2014, type: 'movie' },
      { id: 118340, title: 'Guardians of the Galaxy',                            year: 2014, type: 'movie' },
      { id: 61889,  title: 'Daredevil',                                          year: 2015, type: 'tv',    posterPath: '/QWbPaDxiB6LW2LjASknzYBvjMj.jpg' },
      { id: 99861,  title: 'Avengers: Age of Ultron',                            year: 2015, type: 'movie' },
      { id: 102899, title: 'Ant-Man',                                            year: 2015, type: 'movie', posterPath: '/rQRnQfUl3kfp78nCWq8Ks04vnq1.jpg' },
      { id: 38472,  title: 'Jessica Jones',                                      year: 2015, type: 'tv',    posterPath: '/1ghmaDw650NuUpGI7mYq6xE2QE2.jpg' },
      { id: 271110, title: 'Captain America: Civil War',                         year: 2016, type: 'movie' },
      { id: 62126,  title: 'Luke Cage',                                          year: 2016, type: 'tv',    posterPath: '/yzM1hMB3PUJqbISX0f421b3xOjB.jpg' },
      { id: 284052, title: 'Doctor Strange',                                     year: 2016, type: 'movie' },
      { id: 62127,  title: 'Iron Fist',                                          year: 2017, type: 'tv',    posterPath: '/4l6KD9HhtD6nCDEfg10Lp6C6zah.jpg' },
      { id: 283995, title: 'Guardians of the Galaxy Vol. 2',                     year: 2017, type: 'movie' },
      { id: 315635, title: 'Spider-Man: Homecoming',                             year: 2017, type: 'movie' },
      { id: 62285,  title: 'The Defenders',                                      year: 2017, type: 'tv',    posterPath: '/49XzINhH4LFsgz7cx6TOPcHUJUL.jpg' },
      { id: 284053, title: 'Thor: Ragnarok',                                     year: 2017, type: 'movie' },
      { id: 67178,  title: 'The Punisher',                                       year: 2017, type: 'tv',    posterPath: '/y6wYElX5HaPZItVGJcYGdQO7k8g.jpg' },
      { id: 284054, title: 'Black Panther',                                      year: 2018, type: 'movie' },
      { id: 299536, title: 'Avengers: Infinity War',                             year: 2018, type: 'movie' },
      { id: 363088, title: 'Ant-Man and the Wasp',                               year: 2018, type: 'movie' },
      { id: 299537, title: 'Captain Marvel',                                     year: 2019, type: 'movie' },
      { id: 299534, title: 'Avengers: Endgame',                                  year: 2019, type: 'movie' },
      { id: 429617, title: 'Spider-Man: Far From Home',                          year: 2019, type: 'movie' },
      { id: 85271,  title: 'WandaVision',                                        year: 2021, type: 'tv',    posterPath: '/frobUz2X5Pc8OiVZU8Oo5K3NKMM.jpg' },
      { id: 88396,  title: 'The Falcon and the Winter Soldier',                  year: 2021, type: 'tv',    posterPath: '/6kbAMLteGO8yyewYau6bJ683sw7.jpg' },
      { id: 84958,  title: 'Loki',                                               year: 2021, type: 'tv',    posterPath: '/kEl2t3OhXc3Zb9FBh1AuYzRTgZp.jpg' },
      { id: 497698, title: 'Black Widow',                                        year: 2021, type: 'movie', posterPath: '/7JPpIjhD2V0sKyFvhB9khUMa30d.jpg' },
      { id: 91363,  title: 'What If...?',                                        year: 2021, type: 'tv',    posterPath: '/lztz5XBMG1x6Y5ubz7CxfPFsAcW.jpg' },
      { id: 566525, title: 'Shang-Chi and the Legend of the Ten Rings',          year: 2021, type: 'movie' },
      { id: 524434, title: 'Eternals',                                           year: 2021, type: 'movie', posterPath: '/lFByFSLV5WDJEv3KabbdAF959F2.jpg' },
      { id: 88329,  title: 'Hawkeye',                                            year: 2021, type: 'tv'    },
      { id: 634649, title: 'Spider-Man: No Way Home',                            year: 2021, type: 'movie' },
      { id: 92749,  title: 'Moon Knight',                                        year: 2022, type: 'tv',    posterPath: '/YksR65as1ppF2N48TJAh2PLamX.jpg' },
      { id: 453395, title: 'Doctor Strange in the Multiverse of Madness',        year: 2022, type: 'movie' },
      { id: 92782,  title: 'Ms. Marvel',                                         year: 2022, type: 'tv'    },
      { id: 616037, title: 'Thor: Love and Thunder',                             year: 2022, type: 'movie', posterPath: '/pIkRyD18kl4FhoCNQuWxWu5cBLM.jpg' },
      { id: 232125, title: 'I Am Groot',                                         year: 2022, type: 'tv',    posterPath: '/3QfQYECgu6DX5UUWCBvv1Fl0BAJ.jpg' },
      { id: 92783,  title: 'She-Hulk: Attorney at Law',                          year: 2022, type: 'tv',    posterPath: '/5xz2orV8f0usyrfGNshcoXHmiaV.jpg' },
      { id: 894205, title: 'Werewolf by Night',                                  year: 2022, type: 'movie', posterPath: '/mvIvNKRIJPPS7WSFarFhOAGIVnU.jpg' },
      { id: 505642, title: 'Black Panther: Wakanda Forever',                     year: 2022, type: 'movie' },
      { id: 774752, title: 'The Guardians of the Galaxy Holiday Special',         year: 2022, type: 'movie', posterPath: '/8dqXyslZ2hv49Oiob9UjlGSHSTR.jpg' },
      { id: 640146, title: 'Ant-Man and the Wasp: Quantumania',                  year: 2023, type: 'movie' },
      { id: 447365, title: 'Guardians of the Galaxy Vol. 3',                     year: 2023, type: 'movie' },
      { id: 114472, title: 'Secret Invasion',                                    year: 2023, type: 'tv',    posterPath: '/f5ZMzzCvt2IzVDxr54gHPv9jlC9.jpg' },
      { id: 609681, title: 'The Marvels',                                        year: 2023, type: 'movie' },
      { id: 122226, title: 'Echo',                                               year: 2024, type: 'tv',    posterPath: '/vFyJH630cF68LohVYjQW49074Sy.jpg' },
      { id: 533535, title: 'Deadpool & Wolverine',                               year: 2024, type: 'movie' },
      { id: 138501, title: 'Agatha All Along',                                   year: 2024, type: 'tv',    posterPath: '/mGsxKwXUjojitRv2E9qMTbxbBRd.jpg' },
      { id: 822119, title: 'Captain America: Brave New World',                   year: 2025, type: 'movie', posterPath: '/pzIddUEMWhWzfvLI3TwxUG2wGoi.jpg' },
      { id: 202555, title: 'Daredevil: Born Again',                              year: 2025, type: 'tv',    posterPath: '/xDUoAsU8lQHOOoRkFiBuarmACDN.jpg' },
      { id: 986056, title: 'Thunderbolts*',                                      year: 2025, type: 'movie', posterPath: '/hqcexYHbiTBfDIdDWxrxPtVndBX.jpg' },
      { id: 114471, title: 'Ironheart',                                          year: 2025, type: 'tv',    posterPath: '/dOh6MJpdlQhYpLBhzhNQeYGKTZ5.jpg' },
      { id: 617126, title: 'The Fantastic 4: First Steps',                       year: 2025, type: 'movie', posterPath: '/abqOz6EL3yXyOOafCPZxjL1M5bQ.jpg' },
      { id: 241388, title: 'Eyes of Wakanda',                                    year: 2025, type: 'tv',    posterPath: '/bG23nZW96LxmWkJjsagRZI9hF6t.jpg' },
      { id: 138505, title: 'Marvel Zombies',                                     year: 2025, type: 'tv',    posterPath: '/mwKj9ERGFXsWot0nXgQ5yMQf9I7.jpg' },
      { id: 198178, title: 'Wonder Man',                                         year: 2026, type: 'tv',    posterPath: '/6yy9nQlFt2l6UVWzrfhszFCaZ5C.jpg' },
      { id: 1439930, title: 'The Punisher: One Last Kill',                       year: 2026, type: 'movie', posterPath: '/gOggsBCSypNXq0yApYeXe7nnopT.jpg' },
    ],
    chronological: [
      { id: 241388, title: 'Eyes of Wakanda',                                    year: 2025, type: 'tv',    posterPath: '/bG23nZW96LxmWkJjsagRZI9hF6t.jpg' },
      { id: 1771,   title: 'Captain America: The First Avenger',                 year: 2011, type: 'movie' },
      { id: 211387, title: 'Marvel One-Shot: Agent Carter',                      year: 2013, type: 'movie', posterPath: '/4vFKKWPvCVDJTOWiwReBfpAMScP.jpg' },
      { id: 299537, title: 'Captain Marvel',                                     year: 2019, type: 'movie' },
      { id: 1726,   title: 'Iron Man',                                           year: 2008, type: 'movie' },
      { id: 10138,  title: 'Iron Man 2',                                         year: 2010, type: 'movie' },
      { id: 1724,   title: 'The Incredible Hulk',                                year: 2008, type: 'movie' },
      { id: 76535,  title: "Marvel One-Shot: A Funny Thing Happened on the Way to Thor's Hammer", year: 2011, type: 'movie', posterPath: '/ugrdgmZlSuiavH0NFurhlUPIRD0.jpg' },
      { id: 10195,  title: 'Thor',                                               year: 2011, type: 'movie' },
      { id: 76122,  title: 'Marvel One-Shot: The Consultant',                    year: 2011, type: 'movie', posterPath: '/xqNLXUUvBnfVk6m3QFGGU0Grgs7.jpg' },
      { id: 24428,  title: 'The Avengers',                                       year: 2012, type: 'movie' },
      { id: 119569, title: 'Marvel One-Shot: Item 47',                           year: 2012, type: 'movie', posterPath: '/hnSxG8clwLuAXEkp9emc8HCUcHD.jpg' },
      { id: 76338,  title: 'Thor: The Dark World',                               year: 2013, type: 'movie' },
      { id: 68721,  title: 'Iron Man 3',                                         year: 2013, type: 'movie' },
      { id: 253980, title: 'Marvel One-Shot: All Hail the King',                 year: 2014, type: 'movie', posterPath: '/y0QYZPWgeGKOvyrzi6Oz3aJPxJa.jpg' },
      { id: 100402, title: 'Captain America: The Winter Soldier',                year: 2014, type: 'movie' },
      { id: 118340, title: 'Guardians of the Galaxy',                            year: 2014, type: 'movie' },
      { id: 283995, title: 'Guardians of the Galaxy Vol. 2',                     year: 2017, type: 'movie' },
      { id: 232125, title: 'I Am Groot',                                         year: 2022, type: 'tv',    posterPath: '/3QfQYECgu6DX5UUWCBvv1Fl0BAJ.jpg' },
      { id: 61889,  title: 'Daredevil',                                          year: 2015, type: 'tv',    posterPath: '/QWbPaDxiB6LW2LjASknzYBvjMj.jpg' },
      { id: 38472,  title: 'Jessica Jones',                                      year: 2015, type: 'tv',    posterPath: '/1ghmaDw650NuUpGI7mYq6xE2QE2.jpg' },
      { id: 99861,  title: 'Avengers: Age of Ultron',                            year: 2015, type: 'movie' },
      { id: 102899, title: 'Ant-Man',                                            year: 2015, type: 'movie', posterPath: '/rQRnQfUl3kfp78nCWq8Ks04vnq1.jpg' },
      { id: 62126,  title: 'Luke Cage',                                          year: 2016, type: 'tv',    posterPath: '/yzM1hMB3PUJqbISX0f421b3xOjB.jpg' },
      { id: 62127,  title: 'Iron Fist',                                          year: 2017, type: 'tv',    posterPath: '/4l6KD9HhtD6nCDEfg10Lp6C6zah.jpg' },
      { id: 62285,  title: 'The Defenders',                                      year: 2017, type: 'tv',    posterPath: '/49XzINhH4LFsgz7cx6TOPcHUJUL.jpg' },
      { id: 271110, title: 'Captain America: Civil War',                         year: 2016, type: 'movie' },
      { id: 497698, title: 'Black Widow',                                        year: 2021, type: 'movie', posterPath: '/7JPpIjhD2V0sKyFvhB9khUMa30d.jpg' },
      { id: 284054, title: 'Black Panther',                                      year: 2018, type: 'movie' },
      { id: 315635, title: 'Spider-Man: Homecoming',                             year: 2017, type: 'movie' },
      { id: 67178,  title: 'The Punisher',                                       year: 2017, type: 'tv',    posterPath: '/y6wYElX5HaPZItVGJcYGdQO7k8g.jpg' },
      { id: 284052, title: 'Doctor Strange',                                     year: 2016, type: 'movie' },
      { id: 284053, title: 'Thor: Ragnarok',                                     year: 2017, type: 'movie' },
      { id: 363088, title: 'Ant-Man and the Wasp',                               year: 2018, type: 'movie' },
      { id: 299536, title: 'Avengers: Infinity War',                             year: 2018, type: 'movie' },
      { id: 299534, title: 'Avengers: Endgame',                                  year: 2019, type: 'movie' },
      { id: 84958,  title: 'Loki',                                               year: 2021, type: 'tv',    posterPath: '/kEl2t3OhXc3Zb9FBh1AuYzRTgZp.jpg' },
      { id: 91363,  title: 'What If...?',                                        year: 2021, type: 'tv',    posterPath: '/lztz5XBMG1x6Y5ubz7CxfPFsAcW.jpg' },
      { id: 138505, title: 'Marvel Zombies',                                     year: 2025, type: 'tv',    posterPath: '/mwKj9ERGFXsWot0nXgQ5yMQf9I7.jpg' },
      { id: 85271,  title: 'WandaVision',                                        year: 2021, type: 'tv',    posterPath: '/frobUz2X5Pc8OiVZU8Oo5K3NKMM.jpg' },
      { id: 566525, title: 'Shang-Chi and the Legend of the Ten Rings',          year: 2021, type: 'movie' },
      { id: 88396,  title: 'The Falcon and the Winter Soldier',                  year: 2021, type: 'tv',    posterPath: '/6kbAMLteGO8yyewYau6bJ683sw7.jpg' },
      { id: 429617, title: 'Spider-Man: Far From Home',                          year: 2019, type: 'movie' },
      { id: 524434, title: 'Eternals',                                           year: 2021, type: 'movie', posterPath: '/lFByFSLV5WDJEv3KabbdAF959F2.jpg' },
      { id: 453395, title: 'Doctor Strange in the Multiverse of Madness',        year: 2022, type: 'movie' },
      { id: 88329,  title: 'Hawkeye',                                            year: 2021, type: 'tv'    },
      { id: 92749,  title: 'Moon Knight',                                        year: 2022, type: 'tv',    posterPath: '/YksR65as1ppF2N48TJAh2PLamX.jpg' },
      { id: 505642, title: 'Black Panther: Wakanda Forever',                     year: 2022, type: 'movie' },
      { id: 122226, title: 'Echo',                                               year: 2024, type: 'tv',    posterPath: '/vFyJH630cF68LohVYjQW49074Sy.jpg' },
      { id: 92783,  title: 'She-Hulk: Attorney at Law',                          year: 2022, type: 'tv',    posterPath: '/5xz2orV8f0usyrfGNshcoXHmiaV.jpg' },
      { id: 92782,  title: 'Ms. Marvel',                                         year: 2022, type: 'tv'    },
      { id: 616037, title: 'Thor: Love and Thunder',                             year: 2022, type: 'movie', posterPath: '/pIkRyD18kl4FhoCNQuWxWu5cBLM.jpg' },
      { id: 114471, title: 'Ironheart',                                          year: 2025, type: 'tv',    posterPath: '/dOh6MJpdlQhYpLBhzhNQeYGKTZ5.jpg' },
      { id: 894205, title: 'Werewolf by Night',                                  year: 2022, type: 'movie', posterPath: '/mvIvNKRIJPPS7WSFarFhOAGIVnU.jpg' },
      { id: 774752, title: 'The Guardians of the Galaxy Holiday Special',         year: 2022, type: 'movie', posterPath: '/8dqXyslZ2hv49Oiob9UjlGSHSTR.jpg' },
      { id: 640146, title: 'Ant-Man and the Wasp: Quantumania',                  year: 2023, type: 'movie' },
      { id: 447365, title: 'Guardians of the Galaxy Vol. 3',                     year: 2023, type: 'movie' },
      { id: 114472, title: 'Secret Invasion',                                    year: 2023, type: 'tv',    posterPath: '/f5ZMzzCvt2IzVDxr54gHPv9jlC9.jpg' },
      { id: 609681, title: 'The Marvels',                                        year: 2023, type: 'movie' },
      { id: 634649, title: 'Spider-Man: No Way Home',                            year: 2021, type: 'movie' },
      { id: 533535, title: 'Deadpool & Wolverine',                               year: 2024, type: 'movie' },
      { id: 138501, title: 'Agatha All Along',                                   year: 2024, type: 'tv',    posterPath: '/mGsxKwXUjojitRv2E9qMTbxbBRd.jpg' },
      { id: 202555, title: 'Daredevil: Born Again',                              year: 2025, type: 'tv',    posterPath: '/xDUoAsU8lQHOOoRkFiBuarmACDN.jpg' },
      { id: 822119, title: 'Captain America: Brave New World',                   year: 2025, type: 'movie', posterPath: '/pzIddUEMWhWzfvLI3TwxUG2wGoi.jpg' },
      { id: 986056, title: 'Thunderbolts*',                                      year: 2025, type: 'movie', posterPath: '/hqcexYHbiTBfDIdDWxrxPtVndBX.jpg' },
      { id: 617126, title: 'The Fantastic 4: First Steps',                       year: 2025, type: 'movie', posterPath: '/abqOz6EL3yXyOOafCPZxjL1M5bQ.jpg' },
      { id: 1439930, title: 'The Punisher: One Last Kill',                       year: 2026, type: 'movie', posterPath: '/gOggsBCSypNXq0yApYeXe7nnopT.jpg' },
      { id: 198178, title: 'Wonder Man',                                         year: 2026, type: 'tv',    posterPath: '/6yy9nQlFt2l6UVWzrfhszFCaZ5C.jpg' },
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
      { id: 12180,  title: 'Star Wars: The Clone Wars',           year: 2008, type: 'movie', posterPath: '/iJQfixW818LUdSXlCDL3JZm0S0g.jpg' },
      { id: 4194,   title: 'Star Wars: The Clone Wars',           year: 2008, type: 'tv',    posterPath: '/e1nWfnnCVqxS2LeTO3dwGyAsG2V.jpg' },
      { id: 60554,  title: 'Star Wars Rebels',                    year: 2014, type: 'tv',    posterPath: '/eLrScs6Bs26JMcS8hiZhf7YRROr.jpg' },
      { id: 140607, title: 'Star Wars: The Force Awakens',        year: 2015, type: 'movie' },
      { id: 330459, title: 'Rogue One: A Star Wars Story',        year: 2016, type: 'movie' },
      { id: 181808, title: 'Star Wars: The Last Jedi',            year: 2017, type: 'movie' },
      { id: 348350, title: 'Solo: A Star Wars Story',             year: 2018, type: 'movie' },
      { id: 79093,  title: 'Star Wars Resistance',                year: 2018, type: 'tv',    posterPath: '/xul6SG8rar3wkHPY8YusUtxcdlZ.jpg' },
      { id: 82856,  title: 'The Mandalorian',                     year: 2019, type: 'tv',    posterPath: '/sWgBv7LV2PRoQgkxwlibdGXKz1S.jpg' },
      { id: 181812, title: 'Star Wars: The Rise of Skywalker',    year: 2019, type: 'movie' },
      { id: 115036, title: 'The Book of Boba Fett',               year: 2021, type: 'tv',    posterPath: '/gNbdjDi1HamTCrfvM9JeA94bNi2.jpg' },
      { id: 105971, title: 'Star Wars: The Bad Batch',            year: 2021, type: 'tv',    posterPath: '/5mHus672nuinyaE0FtqvD0AddcY.jpg' },
      { id: 92830,  title: 'Obi-Wan Kenobi',                      year: 2022, type: 'tv',    posterPath: '/4Lok3HBSfbQxibQZBygoVCwKKrZ.jpg' },
      { id: 83867,  title: 'Andor',                               year: 2022, type: 'tv',    posterPath: '/khZqmwHQicTYoS7Flreb9EddFZC.jpg' },
      { id: 203085, title: 'Star Wars: Tales of the Jedi',        year: 2022, type: 'tv',    posterPath: '/k3nWQb0E8mLSR8acSkJP78VRVMv.jpg' },
      { id: 114461, title: 'Ahsoka',                              year: 2023, type: 'tv',    posterPath: '/eiJeWeCAEZAmRppnXHiTWDcCd3Q.jpg' },
      { id: 251091, title: 'Star Wars: Tales of the Empire',      year: 2024, type: 'tv',    posterPath: '/qA28nLteurVboSSzltuyYt1lvlC.jpg' },
      { id: 114479, title: 'The Acolyte',                         year: 2024, type: 'tv',    posterPath: '/mztdt3y6GBsJR69zHtszFezTCLT.jpg' },
      { id: 202879, title: 'Star Wars: Skeleton Crew',            year: 2024, type: 'tv',    posterPath: '/srQbJhLRKoAwRrNN5ga7webPHbC.jpg' },
      { id: 288055, title: 'Star Wars: Tales of the Underworld',  year: 2025, type: 'tv',    posterPath: '/qv1hagzp08cDJF6C04LyJVhcI1x.jpg' },
      { id: 289219, title: 'Star Wars: Maul - Shadow Lord',       year: 2026, type: 'tv',    posterPath: '/fTfLd3s9yBNOzbFHD2aXvwEs93H.jpg' },
    ],
    chronological: [
      { id: 114479, title: 'The Acolyte',                         year: 2024, type: 'tv',    posterPath: '/mztdt3y6GBsJR69zHtszFezTCLT.jpg' },
      { id: 1893,   title: 'Star Wars: The Phantom Menace',       year: 1999, type: 'movie' },
      { id: 1894,   title: 'Star Wars: Attack of the Clones',     year: 2002, type: 'movie' },
      { id: 12180,  title: 'Star Wars: The Clone Wars',           year: 2008, type: 'movie', posterPath: '/iJQfixW818LUdSXlCDL3JZm0S0g.jpg' },
      { id: 4194,   title: 'Star Wars: The Clone Wars',           year: 2008, type: 'tv',    posterPath: '/e1nWfnnCVqxS2LeTO3dwGyAsG2V.jpg' },
      { id: 203085, title: 'Star Wars: Tales of the Jedi',        year: 2022, type: 'tv',    posterPath: '/k3nWQb0E8mLSR8acSkJP78VRVMv.jpg' },
      { id: 1895,   title: 'Star Wars: Revenge of the Sith',      year: 2005, type: 'movie' },
      { id: 251091, title: 'Star Wars: Tales of the Empire',      year: 2024, type: 'tv',    posterPath: '/qA28nLteurVboSSzltuyYt1lvlC.jpg' },
      { id: 288055, title: 'Star Wars: Tales of the Underworld',  year: 2025, type: 'tv',    posterPath: '/qv1hagzp08cDJF6C04LyJVhcI1x.jpg' },
      { id: 105971, title: 'Star Wars: The Bad Batch',            year: 2021, type: 'tv',    posterPath: '/5mHus672nuinyaE0FtqvD0AddcY.jpg' },
      { id: 289219, title: 'Star Wars: Maul - Shadow Lord',       year: 2026, type: 'tv',    posterPath: '/fTfLd3s9yBNOzbFHD2aXvwEs93H.jpg' },
      { id: 348350, title: 'Solo: A Star Wars Story',             year: 2018, type: 'movie' },
      { id: 92830,  title: 'Obi-Wan Kenobi',                      year: 2022, type: 'tv',    posterPath: '/4Lok3HBSfbQxibQZBygoVCwKKrZ.jpg' },
      { id: 83867,  title: 'Andor',                               year: 2022, type: 'tv',    posterPath: '/khZqmwHQicTYoS7Flreb9EddFZC.jpg' },
      { id: 60554,  title: 'Star Wars Rebels',                    year: 2014, type: 'tv',    posterPath: '/eLrScs6Bs26JMcS8hiZhf7YRROr.jpg' },
      { id: 330459, title: 'Rogue One: A Star Wars Story',        year: 2016, type: 'movie' },
      { id: 11,     title: 'Star Wars: A New Hope',               year: 1977, type: 'movie' },
      { id: 1891,   title: 'The Empire Strikes Back',             year: 1980, type: 'movie' },
      { id: 1892,   title: 'Return of the Jedi',                  year: 1983, type: 'movie' },
      { id: 82856,  title: 'The Mandalorian',                     year: 2019, type: 'tv',    posterPath: '/sWgBv7LV2PRoQgkxwlibdGXKz1S.jpg' },
      { id: 115036, title: 'The Book of Boba Fett',               year: 2021, type: 'tv',    posterPath: '/gNbdjDi1HamTCrfvM9JeA94bNi2.jpg' },
      { id: 114461, title: 'Ahsoka',                              year: 2023, type: 'tv',    posterPath: '/eiJeWeCAEZAmRppnXHiTWDcCd3Q.jpg' },
      { id: 202879, title: 'Star Wars: Skeleton Crew',            year: 2024, type: 'tv',    posterPath: '/srQbJhLRKoAwRrNN5ga7webPHbC.jpg' },
      { id: 79093,  title: 'Star Wars Resistance',                year: 2018, type: 'tv',    posterPath: '/xul6SG8rar3wkHPY8YusUtxcdlZ.jpg' },
      { id: 140607, title: 'Star Wars: The Force Awakens',        year: 2015, type: 'movie' },
      { id: 181808, title: 'Star Wars: The Last Jedi',            year: 2017, type: 'movie' },
      { id: 181812, title: 'Star Wars: The Rise of Skywalker',    year: 2019, type: 'movie' },
    ],
  },
  dc: {
    id: 'dc',
    name: 'DC Extended Universe',
    description: 'The complete DCEU in release and chronological order',
    color: '#0476f2',
    entries: [
      { id: 49521,  title: 'Man of Steel',                        year: 2013, type: 'movie', posterPath: '/cB46TSg3kGjq2eVy5kVUhlpUa1H.jpg' },
      { id: 209112, title: 'Batman v Superman: Dawn of Justice',  year: 2016, type: 'movie', posterPath: '/5UsK3grJvtQrtzEgqNlDljJW96w.jpg' },
      { id: 297761, title: 'Suicide Squad',                       year: 2016, type: 'movie', posterPath: '/sk3FZgh3sRrmr8vyhaitNobMcfh.jpg' },
      { id: 297762, title: 'Wonder Woman',                        year: 2017, type: 'movie', posterPath: '/v4ncgZjG2Zu8ZW5al1vIZTsSjqX.jpg' },
      { id: 141052, title: 'Justice League',                      year: 2017, type: 'movie', posterPath: '/eifGNCSDuxJeS1loAXil5bIGgvC.jpg' },
      { id: 297802, title: 'Aquaman',                             year: 2018, type: 'movie', posterPath: '/ufl63EFcc5XpByEV2Ecdw6WJZAI.jpg' },
      { id: 287947, title: 'Shazam!',                             year: 2019, type: 'movie', posterPath: '/xnopI5Xtky18MPhK40cZAGAOVeV.jpg' },
      { id: 495764, title: 'Birds of Prey',                       year: 2020, type: 'movie', posterPath: '/h4VB6m0RwcicVEZvzftYZyKXs6K.jpg' },
      { id: 464052, title: 'Wonder Woman 1984',                   year: 2020, type: 'movie', posterPath: '/8UlWHLMpgZm9bx6QYh0NFoq67TZ.jpg' },
      { id: 436969, title: 'The Suicide Squad',                   year: 2021, type: 'movie', posterPath: '/q61qEyssk2ku3okWICKArlAdhBn.jpg' },
      { id: 110492, title: 'Peacemaker',                          year: 2022, type: 'tv',    posterPath: '/eYzbGcYnOUlvj2fa76pTgIXogd7.jpg' },
      { id: 436270, title: 'Black Adam',                          year: 2022, type: 'movie', posterPath: '/rCtreCr4xiYEWDQTebybolIh6Xe.jpg' },
      { id: 594767, title: 'Shazam! Fury of the Gods',            year: 2023, type: 'movie', posterPath: '/3GrRgt6CiLIUXUtoktcv1g2iwT5.jpg' },
      { id: 298618, title: 'The Flash',                           year: 2023, type: 'movie', posterPath: '/rktDFPbfHfUbArZ6OOOKsXcv0Bm.jpg' },
      { id: 565770, title: 'Blue Beetle',                         year: 2023, type: 'movie', posterPath: '/mXLOHHc1Zeuwsl4xYKjKh2280oL.jpg' },
      { id: 572802, title: 'Aquaman and the Lost Kingdom',        year: 2023, type: 'movie', posterPath: '/7lTnXOy0iNtBAdRP3TZvaKJ77F6.jpg' },
    ],
    chronological: [
      { id: 297762, title: 'Wonder Woman',                        year: 2017, type: 'movie', posterPath: '/v4ncgZjG2Zu8ZW5al1vIZTsSjqX.jpg' },
      { id: 464052, title: 'Wonder Woman 1984',                   year: 2020, type: 'movie', posterPath: '/8UlWHLMpgZm9bx6QYh0NFoq67TZ.jpg' },
      { id: 49521,  title: 'Man of Steel',                        year: 2013, type: 'movie', posterPath: '/cB46TSg3kGjq2eVy5kVUhlpUa1H.jpg' },
      { id: 209112, title: 'Batman v Superman: Dawn of Justice',  year: 2016, type: 'movie', posterPath: '/5UsK3grJvtQrtzEgqNlDljJW96w.jpg' },
      { id: 297761, title: 'Suicide Squad',                       year: 2016, type: 'movie', posterPath: '/sk3FZgh3sRrmr8vyhaitNobMcfh.jpg' },
      { id: 141052, title: 'Justice League',                      year: 2017, type: 'movie', posterPath: '/eifGNCSDuxJeS1loAXil5bIGgvC.jpg' },
      { id: 297802, title: 'Aquaman',                             year: 2018, type: 'movie', posterPath: '/ufl63EFcc5XpByEV2Ecdw6WJZAI.jpg' },
      { id: 287947, title: 'Shazam!',                             year: 2019, type: 'movie', posterPath: '/xnopI5Xtky18MPhK40cZAGAOVeV.jpg' },
      { id: 495764, title: 'Birds of Prey',                       year: 2020, type: 'movie', posterPath: '/h4VB6m0RwcicVEZvzftYZyKXs6K.jpg' },
      { id: 436969, title: 'The Suicide Squad',                   year: 2021, type: 'movie', posterPath: '/q61qEyssk2ku3okWICKArlAdhBn.jpg' },
      { id: 110492, title: 'Peacemaker',                          year: 2022, type: 'tv',    posterPath: '/eYzbGcYnOUlvj2fa76pTgIXogd7.jpg' },
      { id: 436270, title: 'Black Adam',                          year: 2022, type: 'movie', posterPath: '/rCtreCr4xiYEWDQTebybolIh6Xe.jpg' },
      { id: 594767, title: 'Shazam! Fury of the Gods',            year: 2023, type: 'movie', posterPath: '/3GrRgt6CiLIUXUtoktcv1g2iwT5.jpg' },
      { id: 298618, title: 'The Flash',                           year: 2023, type: 'movie', posterPath: '/rktDFPbfHfUbArZ6OOOKsXcv0Bm.jpg' },
      { id: 565770, title: 'Blue Beetle',                         year: 2023, type: 'movie', posterPath: '/mXLOHHc1Zeuwsl4xYKjKh2280oL.jpg' },
      { id: 572802, title: 'Aquaman and the Lost Kingdom',        year: 2023, type: 'movie', posterPath: '/7lTnXOy0iNtBAdRP3TZvaKJ77F6.jpg' },
    ],
  },
  john_wick: {
    id: 'john_wick',
    name: 'John Wick',
    description: 'Be afraid of the man who killed three men with a pencil',
    color: '#fbbf24',
    entries: [
      { id: 245891, title: 'John Wick',                           year: 2014, type: 'movie', posterPath: '/wXqWR7dHncNRbxoEGybEy7QTe9h.jpg' },
      { id: 324552, title: 'John Wick: Chapter 2',                year: 2017, type: 'movie', posterPath: '/hXWBc0ioZP3cN4zCu6SN3YHXZVO.jpg' },
      { id: 458156, title: 'John Wick: Chapter 3 - Parabellum',   year: 2019, type: 'movie', posterPath: '/ziEuG1essDuWuC5lpWUaw1uXY2O.jpg' },
      { id: 603692, title: 'John Wick: Chapter 4',                year: 2023, type: 'movie', posterPath: '/vZloFAK7NmvMGKE7VkF5UHaz0I.jpg' },
      { id: 72710,  title: 'The Continental: From the World of John Wick', year: 2023, type: 'tv', posterPath: '/2urdwqEL9FRkGMKAkhfvWTALG00.jpg' },
      { id: 541671, title: 'Ballerina',                           year: 2025, type: 'movie', posterPath: '/2VUmvqsHb6cEtdfscEA6fqqVzLg.jpg' },
    ],
    chronological: [
      { id: 72710,  title: 'The Continental: From the World of John Wick', year: 2023, type: 'tv', posterPath: '/2urdwqEL9FRkGMKAkhfvWTALG00.jpg' },
      { id: 245891, title: 'John Wick',                           year: 2014, type: 'movie', posterPath: '/wXqWR7dHncNRbxoEGybEy7QTe9h.jpg' },
      { id: 324552, title: 'John Wick: Chapter 2',                year: 2017, type: 'movie', posterPath: '/hXWBc0ioZP3cN4zCu6SN3YHXZVO.jpg' },
      { id: 458156, title: 'John Wick: Chapter 3 - Parabellum',   year: 2019, type: 'movie', posterPath: '/ziEuG1essDuWuC5lpWUaw1uXY2O.jpg' },
      { id: 541671, title: 'Ballerina',                           year: 2025, type: 'movie', posterPath: '/2VUmvqsHb6cEtdfscEA6fqqVzLg.jpg' },
      { id: 603692, title: 'John Wick: Chapter 4',                year: 2023, type: 'movie', posterPath: '/vZloFAK7NmvMGKE7VkF5UHaz0I.jpg' },
    ],
  },
  jurassic_park: {
    id: 'jurassic_park',
    name: 'Jurassic Park',
    description: 'Life finds a way - the complete dinosaur saga',
    color: '#84cc16',
    entries: [
      { id: 329,    title: 'Jurassic Park',                       year: 1993, type: 'movie' },
      { id: 330,    title: 'The Lost World: Jurassic Park',        year: 1997, type: 'movie' },
      { id: 331,    title: 'Jurassic Park III',                    year: 2001, type: 'movie' },
      { id: 135397, title: 'Jurassic World',                      year: 2015, type: 'movie' },
      { id: 351286, title: 'Jurassic World: Fallen Kingdom',      year: 2018, type: 'movie' },
      { id: 93741,  title: 'Jurassic World Camp Cretaceous',      year: 2020, type: 'tv',    posterPath: '/nkCbCmlwjwT6QL44DqG7qE9ch8H.jpg' },
      { id: 1036956, title: 'Jurassic World Camp Cretaceous: Hidden Adventure', year: 2022, type: 'movie', posterPath: '/7ZeqXAT3EXu9uhFXwhyKlH4NAlM.jpg' },
      { id: 507086, title: 'Jurassic World Dominion',             year: 2022, type: 'movie' },
      { id: 237512, title: 'Jurassic World: Chaos Theory',        year: 2024, type: 'tv',    posterPath: '/c2Od0cY2IeayDj5osUxZSAD1QK.jpg' },
      { id: 1234821, title: 'Jurassic World Rebirth',             year: 2025, type: 'movie', posterPath: '/1RICxzeoNCAO5NpcRMIgg1XT6fm.jpg' },
    ],
    chronological: [
      { id: 329,    title: 'Jurassic Park',                       year: 1993, type: 'movie' },
      { id: 330,    title: 'The Lost World: Jurassic Park',        year: 1997, type: 'movie' },
      { id: 331,    title: 'Jurassic Park III',                    year: 2001, type: 'movie' },
      { id: 135397, title: 'Jurassic World',                      year: 2015, type: 'movie' },
      { id: 93741,  title: 'Jurassic World Camp Cretaceous',      year: 2020, type: 'tv',    posterPath: '/nkCbCmlwjwT6QL44DqG7qE9ch8H.jpg' },
      { id: 1036956, title: 'Jurassic World Camp Cretaceous: Hidden Adventure', year: 2022, type: 'movie', posterPath: '/7ZeqXAT3EXu9uhFXwhyKlH4NAlM.jpg' },
      { id: 351286, title: 'Jurassic World: Fallen Kingdom',      year: 2018, type: 'movie' },
      { id: 507086, title: 'Jurassic World Dominion',             year: 2022, type: 'movie' },
      { id: 237512, title: 'Jurassic World: Chaos Theory',        year: 2024, type: 'tv',    posterPath: '/c2Od0cY2IeayDj5osUxZSAD1QK.jpg' },
      { id: 1234821, title: 'Jurassic World Rebirth',             year: 2025, type: 'movie', posterPath: '/1RICxzeoNCAO5NpcRMIgg1XT6fm.jpg' },
    ],
  },
  indiana_jones: {
    id: 'indiana_jones',
    name: 'Indiana Jones',
    description: 'Adventure has a name - the complete Indiana Jones saga',
    color: '#d97706',
    entries: [
      { id: 85,     title: 'Raiders of the Lost Ark',                             year: 1981, type: 'movie' },
      { id: 87,     title: 'Indiana Jones and the Temple of Doom',                year: 1984, type: 'movie' },
      { id: 89,     title: 'Indiana Jones and the Last Crusade',                  year: 1989, type: 'movie' },
      { id: 661,    title: 'The Young Indiana Jones Chronicles',                  year: 1992, type: 'tv',    posterPath: '/iS7NPwkKrfxcFGs0gtll8jXjRZh.jpg' },
      { id: 217,    title: 'Indiana Jones and the Kingdom of the Crystal Skull',  year: 2008, type: 'movie' },
      { id: 335977, title: 'Indiana Jones and the Dial of Destiny',               year: 2023, type: 'movie' },
    ],
    chronological: [
      { id: 661,    title: 'The Young Indiana Jones Chronicles',                  year: 1992, type: 'tv',    posterPath: '/iS7NPwkKrfxcFGs0gtll8jXjRZh.jpg' },
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
    description: 'In space, no one can hear you scream - the complete saga',
    color: '#22c55e',
    entries: [
      { id: 348,    title: 'Alien',                               year: 1979, type: 'movie' },
      { id: 679,    title: 'Aliens',                              year: 1986, type: 'movie' },
      { id: 8077,   title: 'Alien 3',                             year: 1992, type: 'movie' },
      { id: 8078,   title: 'Alien Resurrection',                  year: 1997, type: 'movie' },
      { id: 70981,  title: 'Prometheus',                          year: 2012, type: 'movie' },
      { id: 126889, title: 'Alien: Covenant',                     year: 2017, type: 'movie', posterPath: '/zecMELPbU5YMQpC81Z8ImaaXuf9.jpg' },
      { id: 945961, title: 'Alien: Romulus',                      year: 2024, type: 'movie' },
      { id: 157239, title: 'Alien: Earth',                        year: 2025, type: 'tv',    posterPath: '/yueXS3q8BtoWekcHOATFHicLl3e.jpg' },
    ],
    chronological: [
      { id: 70981,  title: 'Prometheus',                          year: 2012, type: 'movie' },
      { id: 126889, title: 'Alien: Covenant',                     year: 2017, type: 'movie', posterPath: '/zecMELPbU5YMQpC81Z8ImaaXuf9.jpg' },
      { id: 157239, title: 'Alien: Earth',                        year: 2025, type: 'tv',    posterPath: '/yueXS3q8BtoWekcHOATFHicLl3e.jpg' },
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
    description: "I'll be back - the complete Terminator saga",
    color: '#ef4444',
    entries: [
      { id: 218,    title: 'The Terminator',                      year: 1984, type: 'movie' },
      { id: 280,    title: 'Terminator 2: Judgment Day',          year: 1991, type: 'movie' },
      { id: 296,    title: 'Terminator 3: Rise of the Machines',  year: 2003, type: 'movie' },
      { id: 433,    title: 'Terminator: The Sarah Connor Chronicles', year: 2008, type: 'tv', posterPath: '/vkMRWrVrNeX42ruRV5Q15mlBACG.jpg' },
      { id: 534,    title: 'Terminator Salvation',                year: 2009, type: 'movie' },
      { id: 87101,  title: 'Terminator Genisys',                  year: 2015, type: 'movie' },
      { id: 290859, title: 'Terminator: Dark Fate',               year: 2019, type: 'movie', posterPath: '/vqzNJRH4YyquRiWxCCOH0aXggHI.jpg' },
      { id: 239287, title: 'Terminator Zero',                     year: 2024, type: 'tv',    posterPath: '/v4sbn6IsJGAIZNHjdB4CprvS7zo.jpg' },
    ],
  },
  transformers: {
    id: 'transformers',
    name: 'Transformers',
    description: 'More than meets the eye - the complete Transformers saga',
    color: '#f59e0b',
    entries: [
      { id: 1858,   title: 'Transformers',                        year: 2007, type: 'movie' },
      { id: 8373,   title: 'Transformers: Revenge of the Fallen', year: 2009, type: 'movie' },
      { id: 38356,  title: 'Transformers: Dark of the Moon',      year: 2011, type: 'movie' },
      { id: 91314,  title: 'Transformers: Age of Extinction',     year: 2014, type: 'movie' },
      { id: 335988, title: 'Transformers: The Last Knight',       year: 2017, type: 'movie' },
      { id: 424783, title: 'Bumblebee',                           year: 2018, type: 'movie' },
      { id: 667538, title: 'Transformers: Rise of the Beasts',    year: 2023, type: 'movie' },
      { id: 698687, title: 'Transformers One',                    year: 2024, type: 'movie', posterPath: '/iRCgqpdVE4wyLQvGYU3ZP7pAtUc.jpg' },
    ],
    chronological: [
      { id: 698687, title: 'Transformers One',                    year: 2024, type: 'movie', posterPath: '/iRCgqpdVE4wyLQvGYU3ZP7pAtUc.jpg' },
      { id: 424783, title: 'Bumblebee',                           year: 2018, type: 'movie' },
      { id: 667538, title: 'Transformers: Rise of the Beasts',    year: 2023, type: 'movie' },
      { id: 1858,   title: 'Transformers',                        year: 2007, type: 'movie' },
      { id: 8373,   title: 'Transformers: Revenge of the Fallen', year: 2009, type: 'movie' },
      { id: 38356,  title: 'Transformers: Dark of the Moon',      year: 2011, type: 'movie' },
      { id: 91314,  title: 'Transformers: Age of Extinction',     year: 2014, type: 'movie' },
      { id: 335988, title: 'Transformers: The Last Knight',       year: 2017, type: 'movie' },
    ],
  },
  mission_impossible: {
    id: 'mission_impossible',
    name: 'Mission: Impossible',
    description: 'Your mission, should you choose to accept it...',
    color: '#60a5fa',
    entries: [
      { id: 954,    title: 'Mission: Impossible',                 year: 1996, type: 'movie' },
      { id: 955,    title: 'Mission: Impossible II',              year: 2000, type: 'movie' },
      { id: 956,    title: 'Mission: Impossible III',             year: 2006, type: 'movie' },
      { id: 56292,  title: 'Mission: Impossible - Ghost Protocol', year: 2011, type: 'movie', posterPath: '/eRZTGx7GsiKqPch96k27LK005ZL.jpg' },
      { id: 177677, title: 'Mission: Impossible - Rogue Nation',  year: 2015, type: 'movie', posterPath: '/fRJLXQBHK2wyznK5yZbO7vmsuVK.jpg' },
      { id: 353081, title: 'Mission: Impossible - Fallout',       year: 2018, type: 'movie', posterPath: '/AkJQpZp9WoNdj7pLYSj1L0RcMMN.jpg' },
      { id: 575264, title: 'Mission: Impossible - Dead Reckoning Part One', year: 2023, type: 'movie', posterPath: '/NNxYkU70HPurnNCSiCjYAmacwm.jpg' },
      { id: 575265, title: 'Mission: Impossible - The Final Reckoning', year: 2025, type: 'movie', posterPath: '/z53D72EAOxGRqdr7KXXWp9dJiDe.jpg' },
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
      { id: 12444,  title: 'Harry Potter and the Deathly Hallows: Part 1',     year: 2010, type: 'movie', posterPath: '/iGoXIpQb7Pot00EEdwpwPajheZ5.jpg' },
      { id: 12445,  title: 'Harry Potter and the Deathly Hallows: Part 2',     year: 2011, type: 'movie', posterPath: '/c54HpQmuwXjHq2C9wmoACjxoom3.jpg' },
      { id: 259316, title: 'Fantastic Beasts and Where to Find Them',          year: 2016, type: 'movie', posterPath: '/fLsaFKExQt05yqjoAvKsmOMYvJR.jpg' },
      { id: 338952, title: 'Fantastic Beasts: The Crimes of Grindelwald',      year: 2018, type: 'movie' },
      { id: 338953, title: 'Fantastic Beasts: The Secrets of Dumbledore',      year: 2022, type: 'movie', posterPath: '/3c5GNLB4yRSLBby0trHoA1DSQxQ.jpg' },
    ],
    chronological: [
      { id: 259316, title: 'Fantastic Beasts and Where to Find Them',          year: 2016, type: 'movie', posterPath: '/fLsaFKExQt05yqjoAvKsmOMYvJR.jpg' },
      { id: 338952, title: 'Fantastic Beasts: The Crimes of Grindelwald',      year: 2018, type: 'movie' },
      { id: 338953, title: 'Fantastic Beasts: The Secrets of Dumbledore',      year: 2022, type: 'movie', posterPath: '/3c5GNLB4yRSLBby0trHoA1DSQxQ.jpg' },
      { id: 671,    title: "Harry Potter and the Philosopher's Stone",          year: 2001, type: 'movie' },
      { id: 672,    title: 'Harry Potter and the Chamber of Secrets',           year: 2002, type: 'movie' },
      { id: 673,    title: 'Harry Potter and the Prisoner of Azkaban',          year: 2004, type: 'movie' },
      { id: 674,    title: 'Harry Potter and the Goblet of Fire',               year: 2005, type: 'movie' },
      { id: 675,    title: 'Harry Potter and the Order of the Phoenix',         year: 2007, type: 'movie' },
      { id: 767,    title: 'Harry Potter and the Half-Blood Prince',            year: 2009, type: 'movie' },
      { id: 12444,  title: 'Harry Potter and the Deathly Hallows: Part 1',     year: 2010, type: 'movie', posterPath: '/iGoXIpQb7Pot00EEdwpwPajheZ5.jpg' },
      { id: 12445,  title: 'Harry Potter and the Deathly Hallows: Part 2',     year: 2011, type: 'movie', posterPath: '/c54HpQmuwXjHq2C9wmoACjxoom3.jpg' },
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
      { id: 84773,  title: 'The Lord of the Rings: The Rings of Power',         year: 2022, type: 'tv',    posterPath: '/kf5Hz70tjNAHg4swGDzOr9BfoZ1.jpg' },
      { id: 839033, title: 'The Lord of the Rings: The War of the Rohirrim',    year: 2024, type: 'movie', posterPath: '/hE9SAMyMSUGAPsHUGdyl6irv11v.jpg' },
    ],
    chronological: [
      { id: 84773,  title: 'The Lord of the Rings: The Rings of Power',         year: 2022, type: 'tv',    posterPath: '/kf5Hz70tjNAHg4swGDzOr9BfoZ1.jpg' },
      { id: 839033, title: 'The Lord of the Rings: The War of the Rohirrim',    year: 2024, type: 'movie', posterPath: '/hE9SAMyMSUGAPsHUGdyl6irv11v.jpg' },
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
    description: 'The complete Fast & Furious saga - family, speed, and chaos',
    color: '#f97316',
    entries: [
      { id: 9799,   title: 'The Fast and the Furious',            year: 2001, type: 'movie' },
      { id: 77959,  title: 'The Turbo Charged Prelude for 2 Fast 2 Furious', year: 2003, type: 'movie', posterPath: '/cmhFOjy47UqrOafl0oQiygcJ7oT.jpg' },
      { id: 584,    title: '2 Fast 2 Furious',                    year: 2003, type: 'movie' },
      { id: 9615,   title: 'The Fast and the Furious: Tokyo Drift', year: 2006, type: 'movie' },
      { id: 13804,  title: 'Fast & Furious',                      year: 2009, type: 'movie' },
      { id: 253835, title: 'Los Bandoleros',                      year: 2009, type: 'movie', posterPath: '/6QK7BKiEQ10DwGDasxuPhQNb5Bt.jpg' },
      { id: 51497,  title: 'Fast Five',                           year: 2011, type: 'movie' },
      { id: 82992,  title: 'Fast & Furious 6',                    year: 2013, type: 'movie' },
      { id: 168259, title: 'Furious 7',                           year: 2015, type: 'movie' },
      { id: 337339, title: 'The Fate of the Furious',             year: 2017, type: 'movie' },
      { id: 384018, title: 'Fast & Furious Presents: Hobbs & Shaw', year: 2019, type: 'movie' },
      { id: 95594,  title: 'Fast & Furious Spy Racers',           year: 2019, type: 'tv',    posterPath: '/cI7zYWuYTmKEdXITcUKPzjc2EW5.jpg' },
      { id: 385128, title: 'F9',                                  year: 2021, type: 'movie', posterPath: '/deEmLILTPejEb6OGsXRJ5MCvyDW.jpg' },
      { id: 385687, title: 'Fast X',                              year: 2023, type: 'movie' },
    ],
    chronological: [
      { id: 9799,   title: 'The Fast and the Furious',            year: 2001, type: 'movie' },
      { id: 77959,  title: 'The Turbo Charged Prelude for 2 Fast 2 Furious', year: 2003, type: 'movie', posterPath: '/cmhFOjy47UqrOafl0oQiygcJ7oT.jpg' },
      { id: 584,    title: '2 Fast 2 Furious',                    year: 2003, type: 'movie' },
      { id: 253835, title: 'Los Bandoleros',                      year: 2009, type: 'movie', posterPath: '/6QK7BKiEQ10DwGDasxuPhQNb5Bt.jpg' },
      { id: 13804,  title: 'Fast & Furious',                      year: 2009, type: 'movie' },
      { id: 51497,  title: 'Fast Five',                           year: 2011, type: 'movie' },
      { id: 82992,  title: 'Fast & Furious 6',                    year: 2013, type: 'movie' },
      { id: 9615,   title: 'The Fast and the Furious: Tokyo Drift', year: 2006, type: 'movie' },
      { id: 168259, title: 'Furious 7',                           year: 2015, type: 'movie' },
      { id: 337339, title: 'The Fate of the Furious',             year: 2017, type: 'movie' },
      { id: 384018, title: 'Fast & Furious Presents: Hobbs & Shaw', year: 2019, type: 'movie' },
      { id: 95594,  title: 'Fast & Furious Spy Racers',           year: 2019, type: 'tv',    posterPath: '/cI7zYWuYTmKEdXITcUKPzjc2EW5.jpg' },
      { id: 385128, title: 'F9',                                  year: 2021, type: 'movie', posterPath: '/deEmLILTPejEb6OGsXRJ5MCvyDW.jpg' },
      { id: 385687, title: 'Fast X',                              year: 2023, type: 'movie' },
    ],
  },
  james_bond: {
    id: 'james_bond',
    name: 'James Bond',
    description: 'The complete 007 saga - shaken, not stirred',
    color: '#64748b',
    entries: [
      { id: 646,    title: 'Dr. No',                              year: 1962, type: 'movie', posterPath: '/f9HsemSsBEHN5eoMble1bj6fDxs.jpg' },
      { id: 657,    title: 'From Russia with Love',               year: 1963, type: 'movie', posterPath: '/zx4V17FP8oclNvOpTgs2iCCtiYk.jpg' },
      { id: 658,    title: 'Goldfinger',                          year: 1964, type: 'movie', posterPath: '/aKNFzaqQgPzsGXnsMc4kJH5hFIV.jpg' },
      { id: 660,    title: 'Thunderball',                         year: 1965, type: 'movie', posterPath: '/wCc4qllaTDsQN8zgGkAgQrKO6N9.jpg' },
      { id: 667,    title: 'You Only Live Twice',                 year: 1967, type: 'movie', posterPath: '/fdRbvRcEXcf2rC4ghLFZzCWPSmB.jpg' },
      { id: 668,    title: "On Her Majesty's Secret Service",     year: 1969, type: 'movie', posterPath: '/m3KfbxvqaiAvRJ6MpguA3GuLdDQ.jpg' },
      { id: 681,    title: 'Diamonds Are Forever',                year: 1971, type: 'movie', posterPath: '/ooDT0eKrWCxJCsn9JehPkD0QYNj.jpg' },
      { id: 253,    title: 'Live and Let Die',                    year: 1973, type: 'movie', posterPath: '/39qkrjqMZs6utwNmihVImC3ghas.jpg' },
      { id: 682,    title: 'The Man with the Golden Gun',         year: 1974, type: 'movie', posterPath: '/xVkbKwGnBVNQ122GN5bCTMyPbWz.jpg' },
      { id: 691,    title: 'The Spy Who Loved Me',                year: 1977, type: 'movie', posterPath: '/3ZxHKFxMYvAko680DsRgAZKWcLi.jpg' },
      { id: 698,    title: 'Moonraker',                           year: 1979, type: 'movie', posterPath: '/6LrJdXNmu5uHOVALZxVYd44Lva0.jpg' },
      { id: 699,    title: 'For Your Eyes Only',                  year: 1981, type: 'movie', posterPath: '/xV4Nnr6DjjERlqNikqDQX8LUgua.jpg' },
      { id: 700,    title: 'Octopussy',                           year: 1983, type: 'movie', posterPath: '/yoosZitM9igSk3Sd0sBXIhKlAh1.jpg' },
      { id: 707,    title: 'A View to a Kill',                    year: 1985, type: 'movie', posterPath: '/arJF829RP9cYvh0NU70dC5TtXSa.jpg' },
      { id: 708,    title: 'The Living Daylights',                year: 1987, type: 'movie' },
      { id: 709,    title: 'Licence to Kill',                     year: 1989, type: 'movie' },
      { id: 710,    title: 'GoldenEye',                           year: 1995, type: 'movie' },
      { id: 714,    title: 'Tomorrow Never Dies',                 year: 1997, type: 'movie' },
      { id: 36643,  title: 'The World Is Not Enough',             year: 1999, type: 'movie', posterPath: '/wCb2msgoZPK01WIqry24M4xsM73.jpg' },
      { id: 36669,  title: 'Die Another Day',                     year: 2002, type: 'movie', posterPath: '/bZmGqOhMhaLn8AoFMvFDct4tbrL.jpg' },
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

function releaseDateFor(entry: FranchiseEntry) {
  return entry.releaseDate ?? `${entry.year}-12-31`;
}

function hasReleased(entry: FranchiseEntry) {
  if (entry.releaseDate) {
    return entry.releaseDate <= new Date().toISOString().slice(0, 10);
  }

  return entry.year <= new Date().getFullYear();
}

function sortByReleaseDate(entries: FranchiseEntry[]) {
  return entries.filter(hasReleased).sort((a, b) => {
    const byDate = releaseDateFor(a).localeCompare(releaseDateFor(b));
    return byDate !== 0 ? byDate : a.title.localeCompare(b.title);
  });
}

async function fetchAutoReleaseEntries(franchise: Franchise): Promise<FranchiseEntry[]> {
  const collectionIds = new Set(franchise.autoSources?.movieCollectionIds ?? []);

  if (collectionIds.size === 0) return [];

  const entries: FranchiseEntry[] = [];
  await Promise.all([...collectionIds].map(async id => {
    try {
      const collection = await tmdb.collectionDetails(id);
      for (const part of collection.parts ?? []) {
        if (!part.id || !part.title || !part.release_date) continue;
        if (part.release_date > new Date().toISOString().slice(0, 10)) continue;
        entries.push({
          id: part.id,
          title: part.title,
          year: Number(part.release_date.slice(0, 4)),
          type: 'movie',
          posterPath: part.poster_path ?? undefined,
          releaseDate: part.release_date,
          autoDiscovered: true,
        });
      }
    } catch {
      // Auto sources are best-effort; curated entries remain the source of truth.
    }
  }));

  return entries;
}

function mergeReleaseEntries(curated: FranchiseEntry[], discovered: FranchiseEntry[]) {
  if (discovered.length === 0) return curated.filter(hasReleased);

  const byKey = new Map<string, FranchiseEntry>();

  for (const entry of discovered) {
    byKey.set(`${entry.type}-${entry.id}`, entry);
  }

  for (const entry of curated) {
    const key = `${entry.type}-${entry.id}`;
    byKey.set(key, { ...byKey.get(key), ...entry, autoDiscovered: false });
  }

  return sortByReleaseDate([...byKey.values()]);
}

type MarvelGlyphVariant = 'shield' | 'reactor' | 'web' | 'hammer' | 'claw' | 'hex' | 'bolt' | 'star' | 'a';

interface MarvelGlyphProps {
  variant: MarvelGlyphVariant;
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  size: number;
  rotate?: number;
  opacity?: number;
}

function MarvelGlyph({ variant, top, right, bottom, left, size, rotate = 0, opacity = 0.1 }: MarvelGlyphProps) {
  const base: CSSProperties = {
    position: 'absolute',
    top,
    right,
    bottom,
    left,
    width: size,
    height: size,
    opacity,
    color: '#c4c4cc',
    transform: `rotate(${rotate}deg)`,
    transformOrigin: 'center',
    filter: 'drop-shadow(0 0 18px rgba(190,190,205,.18))',
  };

  const line = {
    stroke: 'currentColor',
    strokeWidth: 3.2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    vectorEffect: 'non-scaling-stroke' as const,
  };
  const fineLine = { ...line, strokeWidth: 1.6 };

  let art;
  switch (variant) {
    case 'shield':
      art = (
        <>
          <path d="M50 5 L84 17 C81 51 69 78 50 94 C31 78 19 51 16 17 Z" fill="rgba(196,196,204,.1)" {...line} />
          <path d="M50 20 L58 40 H79 L62 52 L69 74 L50 61 L31 74 L38 52 L21 40 H42 Z" fill="currentColor" opacity=".76" />
          <path d="M50 5 V94" {...fineLine} opacity=".26" />
        </>
      );
      break;
    case 'reactor':
      art = (
        <>
          <circle cx="50" cy="50" r="41" fill="rgba(196,196,204,.07)" {...line} />
          <circle cx="50" cy="50" r="24" {...line} />
          <circle cx="50" cy="50" r="9" fill="currentColor" opacity=".8" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => (
            <path key={angle} d="M50 14 V31" {...fineLine} transform={`rotate(${angle} 50 50)`} opacity=".7" />
          ))}
          {[0, 120, 240].map(angle => (
            <path key={angle} d="M50 28 L66 76 L34 76 Z" {...fineLine} transform={`rotate(${angle} 50 50)`} opacity=".36" />
          ))}
        </>
      );
      break;
    case 'web':
      art = (
        <>
          <circle cx="50" cy="50" r="43" {...fineLine} />
          {[14, 25, 36].map(r => <circle key={r} cx="50" cy="50" r={r} {...fineLine} opacity=".74" />)}
          {[0, 30, 60, 90, 120, 150].map(angle => (
            <path key={angle} d="M50 7 V93" {...fineLine} transform={`rotate(${angle} 50 50)`} opacity=".72" />
          ))}
          <path d="M34 22 C44 30 56 30 66 22 M24 40 C41 48 59 48 76 40 M23 60 C40 53 60 53 77 60 M34 78 C44 70 56 70 66 78" {...fineLine} opacity=".78" />
        </>
      );
      break;
    case 'hammer':
      art = (
        <>
          <path d="M18 20 H76 L88 32 L78 44 H20 L10 32 Z" fill="rgba(196,196,204,.09)" {...line} />
          <path d="M42 43 L58 43 L60 91 L40 91 Z" fill="rgba(196,196,204,.09)" {...line} />
          <path d="M20 27 H76 M23 37 H73 M39 82 H61" {...fineLine} opacity=".58" />
        </>
      );
      break;
    case 'claw':
      art = (
        <>
          <path d="M34 5 C27 30 25 58 14 95" {...line} />
          <path d="M53 5 C47 34 45 60 37 95" {...line} />
          <path d="M73 7 C64 36 62 61 57 94" {...line} />
          <path d="M28 72 C42 67 54 67 68 72" {...fineLine} opacity=".28" />
        </>
      );
      break;
    case 'hex':
      art = (
        <>
          <path d="M26 8 H74 L98 50 L74 92 H26 L2 50 Z" fill="rgba(196,196,204,.08)" {...line} />
          <path d="M38 28 H62 L74 50 L62 72 H38 L26 50 Z" {...fineLine} />
          <path d="M26 8 L38 28 M74 8 L62 28 M98 50 H74 M2 50 H26 M26 92 L38 72 M74 92 L62 72" {...fineLine} opacity=".52" />
        </>
      );
      break;
    case 'bolt':
      art = <path d="M58 4 L20 56 H47 L39 96 L82 40 H55 Z" fill="currentColor" opacity=".76" />;
      break;
    case 'star':
      art = (
        <>
          <path d="M50 8 L62 37 H93 L68 56 L78 88 L50 69 L22 88 L32 56 L7 37 H38 Z" fill="currentColor" opacity=".72" />
          <circle cx="50" cy="50" r="45" {...fineLine} opacity=".4" />
        </>
      );
      break;
    case 'a':
      art = (
        <>
          <path d="M21 91 L50 8 L79 91" {...line} />
          <path d="M34 59 H66" {...line} />
          <path d="M64 25 C82 36 91 58 82 79" {...fineLine} opacity=".72" />
          <path d="M82 79 L70 74 M82 79 L80 66" {...fineLine} opacity=".72" />
        </>
      );
      break;
  }

  const text = variant === 'bolt' ? '⚡' : variant === 'star' ? '★' : 'A';
  return (
    <div data-glyph={text} style={base}>
      <svg viewBox="0 0 100 100" fill="none" role="presentation" focusable="false" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
        {art}
      </svg>
    </div>
  );
}

function MarvelAmbientBackground() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        background: 'radial-gradient(circle at 16% 4%, rgba(180,180,190,.12), transparent 28%), radial-gradient(circle at 88% 16%, rgba(120,120,130,.1), transparent 25%), #000',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.34,
          backgroundImage: 'linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,.9), rgba(0,0,0,.42) 55%, rgba(0,0,0,.88))',
        }}
      />
      <MarvelGlyph variant="shield" top="6%" left="5%" size={176} rotate={-14} opacity={0.11} />
      <MarvelGlyph variant="reactor" top="11%" right="8%" size={150} rotate={11} opacity={0.1} />
      <MarvelGlyph variant="web" top="31%" left="-3%" size={210} rotate={-8} opacity={0.075} />
      <MarvelGlyph variant="hammer" top="41%" right="10%" size={170} rotate={-28} opacity={0.09} />
      <MarvelGlyph variant="claw" top="63%" left="9%" size={150} rotate={17} opacity={0.095} />
      <MarvelGlyph variant="hex" top="69%" right="2%" size={210} rotate={14} opacity={0.075} />
      <MarvelGlyph variant="bolt" top="18%" left="43%" size={118} rotate={9} opacity={0.08} />
      <MarvelGlyph variant="star" top="78%" left="45%" size={132} rotate={-12} opacity={0.07} />
      <MarvelGlyph variant="a" top="50%" left="58%" size={190} rotate={-8} opacity={0.055} />
    </div>
  );
}

type StarWarsGlyphVariant = 'rebellion' | 'empire' | 'deathStar' | 'saber' | 'fighter' | 'helmet' | 'twinSuns' | 'hyperspace' | 'star';

interface StarWarsGlyphProps {
  variant: StarWarsGlyphVariant;
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  size: number;
  rotate?: number;
  opacity?: number;
}

function StarWarsGlyph({ variant, top, right, bottom, left, size, rotate = 0, opacity = 0.1 }: StarWarsGlyphProps) {
  const base: CSSProperties = {
    position: 'absolute',
    top,
    right,
    bottom,
    left,
    width: size,
    height: size,
    opacity,
    color: '#d4d4d8',
    transform: `rotate(${rotate}deg)`,
    transformOrigin: 'center',
    filter: 'drop-shadow(0 0 18px rgba(212,212,216,.14))',
  };
  const line = {
    stroke: 'currentColor',
    strokeWidth: 3,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    vectorEffect: 'non-scaling-stroke' as const,
  };
  const fineLine = { ...line, strokeWidth: 1.5 };

  let art;
  switch (variant) {
    case 'rebellion':
      art = (
        <>
          <circle cx="50" cy="50" r="43" {...fineLine} opacity=".38" />
          <path d="M50 12 C45 29 39 41 26 52 C36 53 43 50 50 42 C57 50 64 53 74 52 C61 41 55 29 50 12 Z" fill="rgba(212,212,216,.16)" {...line} />
          <path d="M23 57 C29 72 39 84 50 91 C61 84 71 72 77 57 M38 57 C41 69 45 78 50 85 M62 57 C59 69 55 78 50 85" {...fineLine} />
        </>
      );
      break;
    case 'empire':
      art = (
        <>
          <circle cx="50" cy="50" r="42" {...line} />
          <circle cx="50" cy="50" r="18" {...fineLine} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => (
            <path key={angle} d="M50 8 V31" {...line} transform={`rotate(${angle} 50 50)`} />
          ))}
          {[22, 67, 112, 157, 202, 247, 292, 337].map(angle => (
            <path key={angle} d="M50 31 V43" {...fineLine} transform={`rotate(${angle} 50 50)`} opacity=".58" />
          ))}
        </>
      );
      break;
    case 'deathStar':
      art = (
        <>
          <circle cx="50" cy="50" r="44" fill="rgba(212,212,216,.07)" {...line} />
          <circle cx="66" cy="34" r="12" {...line} />
          <circle cx="66" cy="34" r="4" fill="currentColor" opacity=".7" />
          <path d="M9 51 H91 M19 32 H44 M17 69 H82 M31 12 C42 23 45 36 43 51 M57 7 C51 23 51 72 60 92" {...fineLine} opacity=".62" />
        </>
      );
      break;
    case 'saber':
      art = (
        <>
          <path d="M26 78 L74 30" {...line} strokeWidth={5} opacity=".9" />
          <path d="M18 86 L36 68" {...line} strokeWidth={8} />
          <path d="M21 74 L30 83 M28 67 L39 78 M18 86 L11 93" {...fineLine} opacity=".65" />
          <path d="M76 28 L88 16" {...fineLine} opacity=".38" />
        </>
      );
      break;
    case 'fighter':
      art = (
        <>
          <path d="M50 9 L59 45 L91 21 L67 54 L92 80 L59 60 L50 91 L41 60 L8 80 L33 54 L9 21 L41 45 Z" fill="rgba(212,212,216,.09)" {...line} />
          <path d="M50 18 V82 M18 76 L82 24 M18 24 L82 76 M36 53 H64" {...fineLine} opacity=".72" />
        </>
      );
      break;
    case 'helmet':
      art = (
        <>
          <path d="M18 51 C18 24 31 10 50 10 C69 10 82 24 82 51 V78 C72 87 61 91 50 91 C39 91 28 87 18 78 Z" fill="rgba(212,212,216,.08)" {...line} />
          <path d="M24 46 C37 40 63 40 76 46 L72 57 C59 53 41 53 28 57 Z" fill="currentColor" opacity=".68" />
          <path d="M36 70 H64 M31 80 C43 85 57 85 69 80 M50 12 V36" {...fineLine} opacity=".65" />
        </>
      );
      break;
    case 'twinSuns':
      art = (
        <>
          <circle cx="38" cy="42" r="18" {...line} />
          <circle cx="64" cy="50" r="13" {...fineLine} />
          <path d="M8 72 H92 M17 81 H83 M28 90 H72" {...line} opacity=".72" />
          <path d="M19 32 L9 25 M38 18 V6 M58 32 L70 25" {...fineLine} opacity=".5" />
        </>
      );
      break;
    case 'hyperspace':
      art = (
        <>
          {[0, 35, 70, 110, 155, 205, 250, 295].map(angle => (
            <path key={angle} d="M50 50 L50 9" {...line} transform={`rotate(${angle} 50 50)`} opacity=".68" />
          ))}
          <circle cx="50" cy="50" r="8" fill="currentColor" opacity=".65" />
        </>
      );
      break;
    case 'star':
      art = (
        <>
          <path d="M50 8 L56 41 L88 50 L56 59 L50 92 L44 59 L12 50 L44 41 Z" fill="currentColor" opacity=".72" />
          <path d="M50 21 V79 M21 50 H79" {...fineLine} opacity=".36" />
        </>
      );
      break;
  }

  return (
    <div style={base}>
      <svg viewBox="0 0 100 100" fill="none" role="presentation" focusable="false" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
        {art}
      </svg>
    </div>
  );
}

function StarWarsAmbientBackground() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        background: 'radial-gradient(circle at 14% 12%, rgba(220,220,225,.11), transparent 26%), radial-gradient(circle at 82% 18%, rgba(160,160,170,.1), transparent 24%), radial-gradient(circle at 50% 120%, rgba(220,220,225,.08), transparent 34%), #000',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.52,
          backgroundImage: 'radial-gradient(circle at 12% 18%, rgba(255,255,255,.55) 0 1px, transparent 1.6px), radial-gradient(circle at 31% 72%, rgba(255,255,255,.38) 0 1px, transparent 1.6px), radial-gradient(circle at 66% 28%, rgba(255,255,255,.45) 0 1px, transparent 1.6px), radial-gradient(circle at 84% 64%, rgba(255,255,255,.34) 0 1px, transparent 1.6px)',
          backgroundSize: '180px 180px, 240px 240px, 210px 210px, 260px 260px',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,.92), rgba(0,0,0,.5) 58%, rgba(0,0,0,.86))',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.12,
          backgroundImage: 'linear-gradient(112deg, transparent 0 43%, rgba(255,255,255,.4) 43.5%, transparent 44%), linear-gradient(112deg, transparent 0 62%, rgba(255,255,255,.25) 62.4%, transparent 63%)',
          backgroundSize: '340px 340px, 520px 520px',
        }}
      />
      <StarWarsGlyph variant="rebellion" top="7%" left="6%" size={166} rotate={-10} opacity={0.105} />
      <StarWarsGlyph variant="empire" top="10%" right="8%" size={170} rotate={12} opacity={0.1} />
      <StarWarsGlyph variant="deathStar" top="34%" left="-4%" size={228} rotate={-8} opacity={0.08} />
      <StarWarsGlyph variant="saber" top="39%" right="8%" size={190} rotate={-21} opacity={0.095} />
      <StarWarsGlyph variant="fighter" top="65%" left="9%" size={158} rotate={18} opacity={0.095} />
      <StarWarsGlyph variant="helmet" top="64%" right="1%" size={214} rotate={8} opacity={0.07} />
      <StarWarsGlyph variant="twinSuns" top="21%" left="43%" size={132} rotate={-4} opacity={0.085} />
      <StarWarsGlyph variant="hyperspace" top="78%" left="45%" size={140} rotate={11} opacity={0.07} />
      <StarWarsGlyph variant="star" top="51%" left="58%" size={126} rotate={-12} opacity={0.065} />
    </div>
  );
}

type DCGlyphVariant = 'bat' | 'shield' | 'bolt' | 'trident' | 'lasso' | 'diamond' | 'card' | 'wave' | 'cowl';

interface DCGlyphProps {
  variant: DCGlyphVariant;
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  size: number;
  rotate?: number;
  opacity?: number;
}

function DCGlyph({ variant, top, right, bottom, left, size, rotate = 0, opacity = 0.1 }: DCGlyphProps) {
  const base: CSSProperties = {
    position: 'absolute',
    top,
    right,
    bottom,
    left,
    width: size,
    height: size,
    opacity,
    color: '#d1d5db',
    transform: `rotate(${rotate}deg)`,
    transformOrigin: 'center',
    filter: 'drop-shadow(0 0 20px rgba(147,197,253,.14))',
  };
  const line = {
    stroke: 'currentColor',
    strokeWidth: 3,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    vectorEffect: 'non-scaling-stroke' as const,
  };
  const fineLine = { ...line, strokeWidth: 1.5 };

  let art;
  switch (variant) {
    case 'bat':
      art = (
        <>
          <ellipse cx="50" cy="50" rx="45" ry="28" fill="rgba(209,213,219,.06)" {...line} />
          <path d="M9 45 C20 34 29 39 34 47 C39 38 45 35 50 48 C55 35 61 38 66 47 C71 39 80 34 91 45 C81 50 78 59 76 68 C66 61 59 63 50 72 C41 63 34 61 24 68 C22 59 19 50 9 45 Z" fill="currentColor" opacity=".75" />
        </>
      );
      break;
    case 'shield':
      art = (
        <>
          <path d="M50 5 L84 18 L76 70 L50 94 L24 70 L16 18 Z" fill="rgba(209,213,219,.08)" {...line} />
          <path d="M35 29 H65 L59 43 H45 L41 54 H61 L50 77 L37 62 H28 Z" fill="currentColor" opacity=".72" />
        </>
      );
      break;
    case 'bolt':
      art = <path d="M58 5 L21 55 H47 L38 95 L82 38 H56 Z" fill="currentColor" opacity=".76" />;
      break;
    case 'trident':
      art = (
        <>
          <path d="M50 10 V92" {...line} />
          <path d="M24 18 C24 34 32 42 50 42 C68 42 76 34 76 18" {...line} />
          <path d="M24 18 L16 30 M24 18 L33 30 M76 18 L67 30 M76 18 L84 30 M50 10 L41 24 M50 10 L59 24" {...fineLine} />
          <path d="M35 70 H65" {...line} />
        </>
      );
      break;
    case 'lasso':
      art = (
        <>
          <circle cx="50" cy="42" r="29" {...line} />
          <path d="M60 66 C76 79 73 94 56 92 C42 91 42 79 53 77" {...fineLine} />
          <path d="M26 51 C39 59 61 59 74 51" {...fineLine} opacity=".62" />
        </>
      );
      break;
    case 'diamond':
      art = (
        <>
          <path d="M50 6 L92 50 L50 94 L8 50 Z" fill="rgba(209,213,219,.07)" {...line} />
          <path d="M50 18 L75 50 L50 82 L25 50 Z" {...fineLine} />
          <path d="M8 50 H92 M50 6 V94" {...fineLine} opacity=".44" />
        </>
      );
      break;
    case 'card':
      art = (
        <>
          <rect x="25" y="10" width="50" height="80" rx="8" fill="rgba(209,213,219,.07)" {...line} />
          <path d="M50 25 C42 17 30 25 34 36 C37 45 50 53 50 53 C50 53 63 45 66 36 C70 25 58 17 50 25 Z" fill="currentColor" opacity=".68" />
          <path d="M35 72 H65 M39 80 H61" {...fineLine} opacity=".62" />
        </>
      );
      break;
    case 'wave':
      art = (
        <>
          <path d="M12 58 C22 45 32 45 42 58 C52 71 62 71 72 58 C80 48 86 46 92 50" {...line} />
          <path d="M12 75 C24 62 35 62 47 75 C59 88 72 88 84 75" {...fineLine} opacity=".62" />
          <path d="M47 23 C53 35 48 45 38 49 C56 50 69 41 66 24 C73 34 78 49 70 63" {...fineLine} opacity=".68" />
        </>
      );
      break;
    case 'cowl':
      art = (
        <>
          <path d="M24 88 V38 L35 14 L45 39 H55 L65 14 L76 38 V88 C63 94 37 94 24 88 Z" fill="rgba(209,213,219,.08)" {...line} />
          <path d="M31 53 C40 49 45 50 49 56 M69 53 C60 49 55 50 51 56" {...line} />
          <path d="M38 76 C45 80 55 80 62 76" {...fineLine} opacity=".55" />
        </>
      );
      break;
  }

  return (
    <div style={base}>
      <svg viewBox="0 0 100 100" fill="none" role="presentation" focusable="false" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
        {art}
      </svg>
    </div>
  );
}

function DCAmbientBackground() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        background: 'radial-gradient(circle at 16% 10%, rgba(96,165,250,.12), transparent 28%), radial-gradient(circle at 88% 22%, rgba(209,213,219,.1), transparent 24%), radial-gradient(circle at 50% 112%, rgba(96,165,250,.08), transparent 34%), #000',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.16,
          backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,.34) 0 1px, transparent 1px), linear-gradient(45deg, rgba(255,255,255,.2) 0 1px, transparent 1px)',
          backgroundSize: '92px 92px, 138px 138px',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,.9), rgba(0,0,0,.44) 56%, rgba(0,0,0,.88))',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.1,
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.52) 0 1px, transparent 1.8px)',
          backgroundSize: '14px 14px',
          maskImage: 'linear-gradient(120deg, transparent, rgba(0,0,0,.86) 28%, rgba(0,0,0,.28) 70%, transparent)',
        }}
      />
      <DCGlyph variant="bat" top="7%" left="5%" size={188} rotate={-8} opacity={0.105} />
      <DCGlyph variant="shield" top="9%" right="8%" size={160} rotate={10} opacity={0.1} />
      <DCGlyph variant="bolt" top="25%" left="45%" size={126} rotate={12} opacity={0.085} />
      <DCGlyph variant="trident" top="38%" right="8%" size={190} rotate={-16} opacity={0.09} />
      <DCGlyph variant="lasso" top="36%" left="-2%" size={224} rotate={10} opacity={0.075} />
      <DCGlyph variant="diamond" top="64%" left="9%" size={152} rotate={16} opacity={0.09} />
      <DCGlyph variant="card" top="66%" right="2%" size={196} rotate={-8} opacity={0.075} />
      <DCGlyph variant="wave" top="79%" left="43%" size={150} rotate={-4} opacity={0.07} />
      <DCGlyph variant="cowl" top="50%" left="58%" size={180} rotate={7} opacity={0.06} />
    </div>
  );
}

type JohnWickGlyphVariant = 'coin' | 'target' | 'pencil' | 'bullet' | 'marker' | 'hotelCard' | 'hourglass' | 'sight';

interface JohnWickGlyphProps {
  variant: JohnWickGlyphVariant;
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  size: number;
  rotate?: number;
  opacity?: number;
}

function JohnWickGlyph({ variant, top, right, bottom, left, size, rotate = 0, opacity = 0.1 }: JohnWickGlyphProps) {
  const base: CSSProperties = {
    position: 'absolute',
    top,
    right,
    bottom,
    left,
    width: size,
    height: size,
    opacity,
    color: '#d6d3d1',
    transform: `rotate(${rotate}deg)`,
    transformOrigin: 'center',
    filter: 'drop-shadow(0 0 18px rgba(251,191,36,.14))',
  };
  const line = {
    stroke: 'currentColor',
    strokeWidth: 3,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    vectorEffect: 'non-scaling-stroke' as const,
  };
  const fineLine = { ...line, strokeWidth: 1.5 };

  let art;
  switch (variant) {
    case 'coin':
      art = (
        <>
          <circle cx="50" cy="50" r="42" fill="rgba(251,191,36,.08)" {...line} />
          <circle cx="50" cy="50" r="30" {...fineLine} opacity=".65" />
          <path d="M35 35 C43 27 57 27 65 35 M35 65 C43 73 57 73 65 65" {...fineLine} opacity=".56" />
          <path d="M50 24 V76 M38 50 H62" {...fineLine} opacity=".52" />
        </>
      );
      break;
    case 'target':
      art = (
        <>
          <circle cx="50" cy="50" r="39" {...line} />
          <circle cx="50" cy="50" r="23" {...fineLine} opacity=".68" />
          <circle cx="50" cy="50" r="7" fill="currentColor" opacity=".58" />
          <path d="M50 5 V25 M50 75 V95 M5 50 H25 M75 50 H95" {...fineLine} opacity=".72" />
        </>
      );
      break;
    case 'pencil':
      art = (
        <>
          <path d="M24 82 L72 34 L84 46 L36 94 L18 100 Z" fill="rgba(214,211,209,.08)" {...line} />
          <path d="M66 28 L74 20 C79 15 88 24 83 29 L76 38 Z" {...line} />
          <path d="M24 82 L36 94 M65 35 L77 47 M18 100 L27 91" {...fineLine} opacity=".68" />
        </>
      );
      break;
    case 'bullet':
      art = (
        <>
          <path d="M36 10 H64 C68 24 71 41 71 58 V82 C71 89 65 94 58 94 H42 C35 94 29 89 29 82 V58 C29 41 32 24 36 10 Z" fill="rgba(214,211,209,.08)" {...line} />
          <path d="M35 28 H65 M30 75 H70 M38 88 H62" {...fineLine} opacity=".66" />
        </>
      );
      break;
    case 'marker':
      art = (
        <>
          <rect x="22" y="12" width="56" height="76" rx="9" fill="rgba(251,191,36,.07)" {...line} />
          <path d="M32 31 H68 M32 50 H68 M40 69 H60" {...fineLine} opacity=".65" />
          <circle cx="50" cy="50" r="21" {...fineLine} opacity=".42" />
        </>
      );
      break;
    case 'hotelCard':
      art = (
        <>
          <rect x="14" y="27" width="72" height="46" rx="6" fill="rgba(214,211,209,.07)" {...line} />
          <path d="M26 42 H50 M26 55 H41 M61 43 H74 M61 55 H74" {...fineLine} opacity=".64" />
          <path d="M53 35 L58 45 L69 47 L61 55 L63 66 L53 61 L43 66 L45 55 L37 47 L48 45 Z" fill="currentColor" opacity=".42" />
        </>
      );
      break;
    case 'hourglass':
      art = (
        <>
          <path d="M28 10 H72 M28 90 H72 M35 10 V28 C35 41 43 44 50 50 C57 56 65 59 65 72 V90 M65 10 V28 C65 41 57 44 50 50 C43 56 35 59 35 72 V90" {...line} />
          <path d="M41 30 C47 35 53 35 59 30 M41 72 C47 67 53 67 59 72" {...fineLine} opacity=".58" />
        </>
      );
      break;
    case 'sight':
      art = (
        <>
          <path d="M14 34 V14 H34 M66 14 H86 V34 M86 66 V86 H66 M34 86 H14 V66" {...line} />
          <path d="M50 20 V38 M50 62 V80 M20 50 H38 M62 50 H80" {...fineLine} opacity=".7" />
          <circle cx="50" cy="50" r="10" {...fineLine} opacity=".68" />
        </>
      );
      break;
  }

  return (
    <div style={base}>
      <svg viewBox="0 0 100 100" fill="none" role="presentation" focusable="false" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
        {art}
      </svg>
    </div>
  );
}

function JohnWickAmbientBackground() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        background: 'radial-gradient(circle at 14% 10%, rgba(251,191,36,.11), transparent 26%), radial-gradient(circle at 86% 16%, rgba(214,211,209,.1), transparent 24%), radial-gradient(circle at 50% 112%, rgba(251,191,36,.07), transparent 34%), #000',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.18,
          backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,.18) 0 1px, transparent 1px), linear-gradient(rgba(251,191,36,.16) 0 1px, transparent 1px)',
          backgroundSize: '86px 86px',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,.9), rgba(0,0,0,.42) 58%, rgba(0,0,0,.88))',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.12,
          backgroundImage: 'radial-gradient(circle, rgba(251,191,36,.72) 0 1px, transparent 1.7px), radial-gradient(circle, rgba(255,255,255,.42) 0 1px, transparent 1.7px)',
          backgroundSize: '130px 130px, 210px 210px',
          backgroundPosition: '0 0, 64px 38px',
        }}
      />
      <JohnWickGlyph variant="coin" top="7%" left="5%" size={176} rotate={-10} opacity={0.115} />
      <JohnWickGlyph variant="target" top="10%" right="8%" size={158} rotate={9} opacity={0.1} />
      <JohnWickGlyph variant="pencil" top="34%" left="-2%" size={218} rotate={-18} opacity={0.08} />
      <JohnWickGlyph variant="bullet" top="38%" right="10%" size={164} rotate={16} opacity={0.095} />
      <JohnWickGlyph variant="marker" top="64%" left="8%" size={158} rotate={12} opacity={0.09} />
      <JohnWickGlyph variant="hotelCard" top="66%" right="2%" size={208} rotate={-8} opacity={0.075} />
      <JohnWickGlyph variant="hourglass" top="22%" left="44%" size={130} rotate={5} opacity={0.08} />
      <JohnWickGlyph variant="sight" top="78%" left="45%" size={148} rotate={-4} opacity={0.07} />
    </div>
  );
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
  const [autoReleaseEntries, setAutoReleaseEntries] = useState<FranchiseEntry[]>([]);
  const fetchedFranchiseRef = useRef<string | null>(null);

  const releaseEntries = useMemo(
    () => franchise ? mergeReleaseEntries(franchise.entries, autoReleaseEntries) : [],
    [franchise, autoReleaseEntries]
  );
  const allEntries = order === 'chronological' && franchise?.chronological
    ? franchise.chronological
    : releaseEntries;
  const entries = typeFilter === 'all' ? allEntries : allEntries.filter(e => e.type === typeFilter);

  // Fetch ALL posters upfront whenever franchise changes
  useEffect(() => {
    if (!franchise) return;
    if (fetchedFranchiseRef.current === franchiseId) return;
    fetchedFranchiseRef.current = franchiseId;

    setPostersLoading(true);
    setPosterMap({});
    setAutoReleaseEntries([]);

    fetchAutoReleaseEntries(franchise).then(setAutoReleaseEntries);

    // Deduplicate curated entries by type+id before fetching
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
    const ids = releaseEntries.map(e => e.id);
    Promise.all([
      supabase.from('watched').select('tmdb_id').eq('user_id', user.id).in('tmdb_id', ids),
      supabase.from('watchlist').select('tmdb_id').eq('user_id', user.id).in('tmdb_id', ids),
    ]).then(([{ data: w }, { data: wl }]) => {
      setWatchedIds(new Set((w ?? []).map((r: { tmdb_id: number }) => r.tmdb_id)));
      setWatchlistIds(new Set((wl ?? []).map((r: { tmdb_id: number }) => r.tmdb_id)));
    });
  }, [user, franchiseId, releaseEntries]);

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

  const totalEntries = releaseEntries.length;
  const watchedCount = releaseEntries.filter(e => watchedIds.has(e.id)).length;
  const progress = totalEntries > 0 ? (watchedCount / totalEntries) * 100 : 0;
  const hasChronological = !!franchise.chronological;
  const hasTV = allEntries.some(e => e.type === 'tv');

  return (
    <div style={{ minHeight: '100vh', background: '#000', paddingBottom: 96, position: 'relative' }} className="animate-fade-in">
      {franchiseId === 'marvel' && <MarvelAmbientBackground />}
      {franchiseId === 'star_wars' && <StarWarsAmbientBackground />}
      {franchiseId === 'dc' && <DCAmbientBackground />}
      {franchiseId === 'john_wick' && <JohnWickAmbientBackground />}

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

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px clamp(16px,4vw,48px) 0', position: 'relative', zIndex: 1 }}>
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
            const posterPath = entry.posterPath ?? posterMap[key];
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
