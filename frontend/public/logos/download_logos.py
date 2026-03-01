"""
Script to download NCAA team logos from SportsLogos.net.
Downloads the primary logo for each specified team as a PNG file.
"""

import requests
import re
import time
import os
import shutil
from typing import Optional

# Output directory for logos
OUTPUT_DIR = "/Users/Josh/Desktop/Projects/march-madness-pool-analytics/frontend/public/logos"

# Headers to mimic a browser request
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    # Note: Do NOT set Accept-Encoding manually — requests handles decompression
    # automatically only when it sets the header itself. Manual setting causes
    # the compressed bytes to be returned without auto-decoding.
    "Connection": "keep-alive",
}

# Mapping of output filename -> (league_id, team_id, team_slug)
# Format: "filename_without_ext": (league_id, team_id, slug)
TEAMS = {
    "Abilene Christian": (30, 5071, "Abilene-Christian-Wildcats-Logos"),
    "Air Force": (30, 595, "Air-Force-Falcons-Logos"),
    "Akron": (30, 596, "Akron-Zips-Logos"),
    "Alabama": (30, 597, "Alabama-Crimson-Tide-Logos"),
    "Alabama A&M": (30, 598, "Alabama-AM-Bulldogs-Logos"),
    "Alabama State": (30, 599, "Alabama-State-Hornets-Logos"),
    "Albany": (30, 818, "Albany-Great-Danes-Logos"),
    "Alcorn State": (30, 600, "Alcorn-State-Braves-Logos"),
    "American": (30, 601, "American-Eagles-Logos"),
    "App State": (30, 602, "Appalachian-State-Mountaineers-Logos"),
    "Arizona": (30, 603, "Arizona-Wildcats-Logos"),
    "Arizona State": (30, 604, "Arizona-State-Sun-Devils-Logos"),
    "Arkansas": (30, 606, "Arkansas-Razorbacks-Logos"),
    "Arkansas State": (30, 605, "Arkansas-State-Red-Wolves-Logos"),
    "Arkansas-Pine Bluff": (30, 608, "Arkansas-PB-Golden-Lions-Logos"),
    "Army": (30, 609, "Army-Black-Knights-Logos"),
    "Auburn": (30, 610, "Auburn-Tigers-Logos"),
    "Austin Peay": (30, 611, "Austin-Peay-Governors-Logos"),
    "Ball State": (30, 612, "Ball-State-Cardinals-Logos"),
    "Baylor": (30, 613, "Baylor-Bears-Logos"),
    "Bellarmine": (30, 6811, "Bellarmine-Knights-Logos"),
    "Belmont": (30, 614, "Belmont-Bruins-Logos"),
    "Bethune-Cookman": (30, 615, "Bethune-Cookman-Wildcats-Logos"),
    "Binghamton": (30, 855, "Binghamton-Bearcats-Logos"),
    "Boise State": (30, 617, "Boise-State-Broncos-Logos"),
    "Boston College": (30, 618, "Boston-College-Eagles-Logos"),
    "Boston University": (30, 619, "Boston-University-Terriers-Logos"),
    "Bowling Green": (30, 620, "Bowling-Green-Falcons-Logos"),
    "Bradley": (30, 621, "Bradley-Braves-Logos"),
    "Brown": (30, 623, "Brown-Bears-Logos"),
    "Bryant": (30, 5021, "Bryant-Bulldogs-Logos"),
    "Bucknell": (30, 624, "Bucknell-Bison-Logos"),
    "Buffalo": (30, 819, "Buffalo-Bulls-Logos"),
    "Butler": (30, 625, "Butler-Bulldogs-Logos"),
    "BYU": (30, 622, "Brigham-Young-Cougars-Logos"),
    "Cal Poly": (30, 626, "Cal-Poly-Mustangs-Logos"),
    "Cal State Bakersfield": (30, 5046, "CSU-Bakersfield-Roadrunners-Logos"),
    "Cal State Fullerton": (30, 627, "Cal-State-Fullerton-Titans-Logos"),
    "Cal State Northridge": (30, 628, "Cal-State-Northridge-Matadors-Logos"),
    "California": (30, 630, "California-Golden-Bears-Logos"),
    "California Baptist": (30, 6812, "California-Baptist-Lancers-Logos"),
    "Campbell": (30, 631, "Campbell-Fighting-Camels-Logos"),
    "Canisius": (30, 632, "Canisius-Golden-Griffins-Logos"),
    "Central Arkansas": (30, 5028, "Central-Arkansas-Bears-Logos"),
    "Central Connecticut": (30, 634, "Central-Connecticut-Blue-Devils-Logos"),
    "Central Florida": (30, 635, "Central-Florida-Knights-Logos"),
    "Central Michigan": (30, 636, "Central-Michigan-Chippewas-Logos"),
    "Charleston": (30, 637, "College-of-Charleston-Cougars-Logos"),
    "Charleston Southern": (30, 638, "CSU-Buccaneers-Logos"),
    "Charlotte": (30, 639, "Charlotte-49ers-Logos"),
    "Chattanooga": (30, 640, "Chattanooga-Mocs-Logos"),
    "Chicago State": (30, 641, "Chicago-State-Cougars-Logos"),
    "Cincinnati": (30, 642, "Cincinnati-Bearcats-Logos"),
    "Clemson": (30, 643, "Clemson-Tigers-Logos"),
    "Cleveland State": (30, 644, "Cleveland-State-Vikings-Logos"),
    "Coastal Carolina": (30, 645, "Coastal-Carolina-Chanticleers-Logos"),
    "Colgate": (30, 646, "Colgate-Raiders-Logos"),
    "Colorado": (30, 647, "Colorado-Buffaloes-Logos"),
    "Colorado State": (30, 648, "Colorado-State-Rams-Logos"),
    "Columbia": (30, 649, "Columbia-Lions-Logos"),
    "Coppin State": (30, 650, "Coppin-State-Eagles-Logos"),
    "Cornell": (30, 651, "Cornell-Big-Red-Logos"),
    "Creighton": (30, 652, "Creighton-Bluejays-Logos"),
    "Dartmouth": (31, 653, "Dartmouth-Big-Green-Logos"),
    "Davidson": (31, 654, "Davidson-Wildcats-Logos"),
    "Dayton": (31, 655, "Dayton-Flyers-Logos"),
    "Delaware": (31, 657, "Delaware-Blue-Hens-Logos"),
    "Delaware State": (31, 658, "Delaware-State-Hornets-Logos"),
    "Denver": (31, 659, "Denver-Pioneers-Logos"),
    "DePaul": (31, 656, "DePaul-Blue-Demons-Logos"),
    "Detroit Mercy": (31, 660, "Detroit-Mercy-Titans-Logos"),
    "Drake": (31, 661, "Drake-Bulldogs-Logos"),
    "Drexel": (31, 662, "Drexel-Dragons-Logos"),
    "Duke": (31, 663, "Duke-Blue-Devils-Logos"),
    "Duquesne": (31, 664, "Duquesne-Dukes-Logos"),
    "East Carolina": (31, 665, "East-Carolina-Pirates-Logos"),
    "East Tennessee State": (31, 666, "ETSU-Buccaneers-Logos"),
    "East Texas A&M": (30, 6863, "AM-Commerce-Lions-Logos"),
    "Eastern Illinois": (31, 667, "Eastern-Illinois-Panthers-Logos"),
    "Eastern Kentucky": (31, 668, "Eastern-Kentucky-Colonels-Logos"),
    "Eastern Michigan": (31, 669, "Eastern-Michigan-Eagles-Logos"),
    "Eastern Washington": (31, 670, "Eastern-Washington-Eagles-Logos"),
    "Elon": (31, 671, "Elon-Phoenix-Logos"),
    "Evansville": (31, 672, "Evansville-Purple-Aces-Logos"),
    "Fairfield": (31, 673, "Fairfield-Stags-Logos"),
    "Fairleigh Dickinson": (31, 674, "Fairleigh-Dickinson-Knights-Logos"),
    "Florida": (31, 675, "Florida-Gators-Logos"),
    "Florida A&M": (31, 676, "Florida-AM-Rattlers-Logos"),
    "Florida Atlantic": (31, 677, "Florida-Atlantic-Owls-Logos"),
    "Florida Gulf Coast": (31, 4946, "Florida-Gulf-Coast-Eagles-Logos"),
    "Florida International": (31, 678, "FIU-Panthers-Logos"),
    "Florida State": (31, 679, "Florida-State-Seminoles-Logos"),
    "Fordham": (31, 680, "Fordham-Rams-Logos"),
    "Fresno State": (31, 681, "Fresno-State-Bulldogs-Logos"),
    "Furman": (31, 682, "Furman-Paladins-Logos"),
    "Gardner-Webb": (31, 683, "Gardner-Webb-Bulldogs-Logos"),
    "George Mason": (31, 684, "George-Mason-Patriots-Logos"),
    "George Washington": (31, 685, "George-Washington-Colonials-Logos"),
    "Georgetown": (31, 686, "Georgetown-Hoyas-Logos"),
    "Georgia": (31, 687, "Georgia-Bulldogs-Logos"),
    "Georgia Southern": (31, 688, "Georgia-Southern-Eagles-Logos"),
    "Georgia State": (31, 689, "Georgia-State-Panthers-Logos"),
    "Georgia Tech": (31, 690, "Georgia-Tech-Yellow-Jackets-Logos"),
    "Gonzaga": (31, 691, "Gonzaga-Bulldogs-Logos"),
    "Grambling": (31, 692, "Grambling-State-Tigers-Logos"),
    "Grand Canyon": (31, 5050, "Grand-Canyon-Antelopes-Logos"),
    "Green Bay": (35, 891, "Wisconsin-Green-Bay-Phoenix-Logos"),
    "Hampton": (31, 693, "Hampton-Pirates-Logos"),
    "Hartford": (31, 694, "Hartford-Hawks-Logos"),
    "Harvard": (31, 695, "Harvard-Crimson-Logos"),
    "Hawaii": (31, 696, "Hawaii-Warriors-Logos"),
    "High Point": (31, 697, "High-Point-Panthers-Logos"),
    "Hofstra": (31, 698, "Hofstra-Pride-Logos"),
    "Holy Cross": (31, 699, "Holy-Cross-Crusaders-Logos"),
    "Houston": (31, 700, "Houston-Cougars-Logos"),
    "Houston Baptist": (31, 5048, "Houston-Baptist-Huskies-Logos"),
    "Houston Christian": (31, 6867, "Houston-Christian-Huskies-Logos"),
    "Howard": (31, 701, "Howard-Bison-Logos"),
    "Idaho": (32, 704, "Idaho-Vandals-Logos"),
    "Idaho State": (32, 705, "Idaho-State-Bengals-Logos"),
    "Illinois": (32, 706, "Illinois-Fighting-Illini-Logos"),
    "Illinois State": (32, 707, "Illinois-State-Redbirds-Logos"),
    "Incarnate Word": (32, 5075, "Incarnate-Word-Cardinals-Logos"),
    "Indiana": (32, 709, "Indiana-Hoosiers-Logos"),
    "Indiana State": (32, 710, "Indiana-State-Sycamores-Logos"),
    "Iona": (32, 711, "Iona-Gaels-Logos"),
    "Iowa": (32, 712, "Iowa-Hawkeyes-Logos"),
    "Iowa State": (32, 713, "Iowa-State-Cyclones-Logos"),
    "IU Indianapolis": (32, 703, "IUPUI-Jaguars-Logos"),
    "Jackson State": (32, 714, "Jackson-State-Tigers-Logos"),
    "Jacksonville": (32, 715, "Jacksonville-Dolphins-Logos"),
    "Jacksonville State": (32, 716, "Jacksonville-State-Gamecocks-Logos"),
    "James Madison": (32, 717, "James-Madison-Dukes-Logos"),
    "Kansas": (32, 718, "Kansas-Jayhawks-Logos"),
    "Kansas City": (32, 6704, "Kansas-City-Roos-Logos"),
    "Kansas State": (32, 719, "Kansas-State-Wildcats-Logos"),
    "Kennesaw State": (32, 4949, "Kennesaw-State-Owls-Logos"),
    "Kent State": (32, 720, "Kent-State-Golden-Flashes-Logos"),
    "Kentucky": (32, 721, "Kentucky-Wildcats-Logos"),
    "La Salle": (32, 724, "La-Salle-Explorers-Logos"),
    "Lafayette": (32, 725, "Lafayette-Leopards-Logos"),
    "Lamar": (32, 726, "Lamar-Cardinals-Logos"),
    "Le Moyne": (32, 6865, "Le-Moyne-Dolphins-Logos"),
    "Lehigh": (32, 727, "Lehigh-Mountain-Hawks-Logos"),
    "Liberty": (32, 728, "Liberty-Flames-Logos"),
    "Lindenwood": (32, 6858, "Lindenwood-Lions-Logos"),
    "Lipscomb": (32, 729, "Lipscomb-Bisons-Logos"),
    "Little Rock": (32, 5844, "Little-Rock-Trojans-Logos"),
    "LIU Brooklyn": (32, 722, "LIU-Brooklyn-Blackbirds-Logos"),
    "Long Beach State": (32, 730, "Long-Beach-State-49ers-Logos"),
    "Long Island University": (32, 6705, "LIU-Sharks-Logos"),
    "Longwood": (32, 2609, "Longwood-Lancers-Logos"),
    "Louisiana": (32, 732, "Louisiana-Ragin-Cajuns-Logos"),
    "Louisiana Tech": (32, 731, "Louisiana-Tech-Bulldogs-Logos"),
    "Louisville": (32, 734, "Louisville-Cardinals-Logos"),
    "Loyola Chicago": (32, 735, "Loyola-Ramblers-Logos"),
    "Loyola Maryland": (32, 736, "Loyola-Maryland-Greyhounds-Logos"),
    "Loyola Marymount": (32, 737, "Loyola-Marymount-Lions-Logos"),
    "LSU": (32, 723, "LSU-Tigers-Logos"),
    "Maine": (32, 738, "Maine-Black-Bears-Logos"),
    "Manhattan": (32, 739, "Manhattan-Jaspers-Logos"),
    "Marist": (32, 740, "Marist-Red-Foxes-Logos"),
    "Marquette": (32, 741, "Marquette-Golden-Eagles-Logos"),
    "Marshall": (32, 742, "Marshall-Thundering-Herd-Logos"),
    "Maryland": (32, 743, "Maryland-Terrapins-Logos"),
    "Maryland Eastern Shore": (32, 744, "Maryland-Eastern-Shore-Hawks-Logos"),
    "Massachusetts": (32, 887, "Massachusetts-Minutemen-Logos"),
    "McNeese State": (32, 745, "McNeese-State-Cowboys-Logos"),
    "Memphis": (32, 746, "Memphis-Tigers-Logos"),
    "Mercer": (32, 747, "Mercer-Bears-Logos"),
    "Mercyhurst": (32, 5328, "Mercyhurst-Lakers-Logos"),
    "Merrimack": (32, 5022, "Merrimack-Warriors-Logos"),
    "Miami": (32, 748, "Miami-Hurricanes-Logos"),
    "Miami (OH)": (32, 749, "Miami-Ohio-Redhawks-Logos"),
    "Michigan": (32, 750, "Michigan-Wolverines-Logos"),
    "Michigan State": (32, 751, "Michigan-State-Spartans-Logos"),
    "Middle Tennessee": (32, 752, "Middle-Tennessee-Blue-Raiders-Logos"),
    "Milwaukee": (35, 915, "Wisconsin-Milwaukee-Panthers-Logos"),
    "Minnesota": (32, 753, "Minnesota-Golden-Gophers-Logos"),
    "Mississippi State": (32, 755, "Mississippi-State-Bulldogs-Logos"),
    "Mississippi Valley State": (32, 756, "MVSU-Delta-Devils-Logos"),
    "Missouri": (32, 757, "Missouri-Tigers-Logos"),
    "Missouri State": (32, 4974, "Missouri-State-Bears-Logos"),
    "Monmouth": (32, 758, "Monmouth-Hawks-Logos"),
    "Montana": (32, 759, "Montana-Grizzlies-Logos"),
    "Montana State": (32, 760, "Montana-State-Bobcats-Logos"),
    "Morehead State": (32, 761, "Morehead-State-Eagles-Logos"),
    "Morgan State": (32, 762, "Morgan-State-Bears-Logos"),
    "Mount St. Mary's": (32, 763, "Mount-St-Marys-Mountaineers-Logos"),
    "Murray State": (32, 764, "Murray-State-Racers-Logos"),
    "Navy": (33, 765, "Navy-Midshipmen-Logos"),
    "NC State": (33, 777, "North-Carolina-State-Wolfpack-Logos"),
    "Nebraska": (33, 766, "Nebraska-Cornhuskers-Logos"),
    "Nevada": (33, 767, "Nevada-Wolf-Pack-Logos"),
    "New Hampshire": (33, 768, "New-Hampshire-Wildcats-Logos"),
    "New Mexico": (33, 769, "New-Mexico-Lobos-Logos"),
    "New Mexico State": (33, 770, "New-Mexico-State-Aggies-Logos"),
    "New Orleans": (33, 771, "New-Orleans-Privateers-Logos"),
    "Niagara": (33, 772, "Niagara-Purple-Eagles-Logos"),
    "Nicholls State": (33, 773, "Nicholls-State-Colonels-Logos"),
    "NJIT": (33, 2605, "NJIT-Highlanders-Logos"),
    "Norfolk State": (33, 774, "Norfolk-State-Spartans-Logos"),
    "North Alabama": (33, 4754, "North-Alabama-Lions-Logos"),
    "North Carolina": (33, 775, "North-Carolina-Tar-Heels-Logos"),
    "North Carolina A&T": (33, 776, "North-Carolina-AT-Aggies-Logos"),
    "North Carolina Central": (33, 5020, "NCCU-Eagles-Logos"),
    "North Dakota": (33, 2607, "North-Dakota-Fighting-Hawks-Logos"),
    "North Dakota State": (33, 781, "North-Dakota-State-Bison-Logos"),
    "North Florida": (35, 4947, "UNF-Ospreys-Logos"),
    "North Texas": (33, 782, "North-Texas-Mean-Green-Logos"),
    "Northeastern": (33, 783, "Northeastern-Huskies-Logos"),
    "Northern Arizona": (33, 784, "Northern-Arizona-Lumberjacks-Logos"),
    "Northern Colorado": (33, 4954, "Northern-Colorado-Bears-Logos"),
    "Northern Illinois": (33, 785, "Northern-Illinois-Huskies-Logos"),
    "Northern Iowa": (33, 786, "Northern-Iowa-Panthers-Logos"),
    "Northern Kentucky": (33, 5047, "Northern-Kentucky-Norse-Logos"),
    "Northwestern": (33, 787, "Northwestern-Wildcats-Logos"),
    "Northwestern State": (33, 788, "Northwestern-State-Demons-Logos"),
    "Notre Dame": (33, 789, "Notre-Dame-Fighting-Irish-Logos"),
    "Oakland": (33, 790, "Oakland-Golden-Grizzlies-Logos"),
    "Ohio": (33, 792, "Ohio-Bobcats-Logos"),
    "Ohio State": (33, 791, "Ohio-State-Buckeyes-Logos"),
    "Oklahoma": (33, 793, "Oklahoma-Sooners-Logos"),
    "Oklahoma State": (33, 794, "Oklahoma-State-Cowboys-Logos"),
    "Old Dominion": (33, 795, "Old-Dominion-Monarchs-Logos"),
    "Ole Miss": (32, 754, "Mississippi-Rebels-Logos"),
    "Omaha": (33, 5049, "Nebraska-Omaha-Mavericks-Logos"),
    "Oral Roberts": (33, 796, "Oral-Roberts-Golden-Eagles-Logos"),
    "Oregon": (33, 797, "Oregon-Ducks-Logos"),
    "Oregon State": (33, 798, "Oregon-State-Beavers-Logos"),
    "Pacific": (33, 799, "Pacific-Tigers-Logos"),
    "Penn": (33, 800, "Penn-Quakers-Logos"),
    "Penn State": (33, 801, "Penn-State-Nittany-Lions-Logos"),
    "Pepperdine": (33, 802, "Pepperdine-Waves-Logos"),
    "Pittsburgh": (33, 803, "Pittsburgh-Panthers-Logos"),
    "Portland": (33, 804, "Portland-Pilots-Logos"),
    "Portland State": (33, 805, "Portland-State-Vikings-Logos"),
    "Prairie View A&M": (33, 806, "Prairie-View-AM-Panthers-Logos"),
    "Presbyterian": (33, 5053, "Presbyterian-Blue-Hose-Logos"),
    "Princeton": (33, 807, "Princeton-Tigers-Logos"),
    "Providence": (33, 808, "Providence-Friars-Logos"),
    "Purdue": (33, 809, "Purdue-Boilermakers-Logos"),
    "Purdue Fort Wayne": (33, 6619, "Purdue-Fort-Wayne-Mastodons-Logos"),
    "Queens": (33, 6859, "Queens-Royals-Logos"),
    "Quinnipiac": (33, 810, "Quinnipiac-Bobcats-Logos"),
    "Radford": (33, 811, "Radford-Highlanders-Logos"),
    "Rhode Island": (33, 812, "Rhode-Island-Rams-Logos"),
    "Rice": (33, 813, "Rice-Owls-Logos"),
    "Richmond": (33, 814, "Richmond-Spiders-Logos"),
    "Rider": (33, 815, "Rider-Broncs-Logos"),
    "Robert Morris": (33, 816, "Robert-Morris-Colonials-Logos"),
    "Rutgers": (33, 817, "Rutgers-Scarlet-Knights-Logos"),
    "Sacramento State": (30, 629, "Sacramento-State-Hornets-Logos"),
    "Sacred Heart": (34, 820, "Sacred-Heart-Pioneers-Logos"),
    "Saint Joseph's": (34, 851, "St-Josephs-Hawks-Logos"),
    "Saint Louis": (34, 822, "Saint-Louis-Billikens-Logos"),
    "Saint Mary's": (34, 852, "Saint-Marys-Gaels-Logos"),
    "Saint Peter's": (34, 853, "Saint-Peters-Peacocks-Logos"),
    "Sam Houston State": (34, 823, "Sam-Houston-State-Bearkats-Logos"),
    "Samford": (34, 824, "Samford-Bulldogs-Logos"),
    "San Diego": (34, 825, "San-Diego-Toreros-Logos"),
    "San Diego State": (34, 826, "San-Diego-State-Aztecs-Logos"),
    "San Francisco": (34, 827, "San-Francisco-Dons-Logos"),
    "San Jose State": (34, 828, "San-Jose-State-Spartans-Logos"),
    "Santa Clara": (34, 829, "Santa-Clara-Broncos-Logos"),
    "Savannah State": (34, 830, "Savannah-State-Tigers-Logos"),
    "Seattle": (34, 5052, "Seattle-Redhawks-Logos"),
    "Seton Hall": (34, 831, "Seton-Hall-Pirates-Logos"),
    "Siena": (34, 832, "Siena-Saints-Logos"),
    "SIU Edwardsville": (34, 5051, "SIU-Edwardsville-Cougars-Logos"),
    "SMU": (34, 842, "SMU-Mustangs-Logos"),
    "South Alabama": (34, 833, "South-Alabama-Jaguars-Logos"),
    "South Carolina": (34, 834, "South-Carolina-Gamecocks-Logos"),
    "South Carolina State": (34, 835, "South-Carolina-State-Bulldogs-Logos"),
    "South Carolina Upstate": (35, 4948, "USC-Upstate-Spartans-Logos"),
    "South Dakota": (34, 5037, "South-Dakota-Coyotes-Logos"),
    "South Dakota State": (34, 836, "South-Dakota-State-Jackrabbits-Logos"),
    "South Florida": (34, 837, "South-Florida-Bulls-Logos"),
    "Southeast Missouri State": (34, 838, "SE-Missouri-State-Redhawks-Logos"),
    "Southeastern Louisiana": (34, 839, "Southeastern-Louisiana-Lions-Logos"),
    "Southern": (34, 845, "Southern-Jaguars-Logos"),
    "Southern Illinois": (34, 841, "Southern-Illinois-Salukis-Logos"),
    "Southern Indiana": (34, 6860, "Southern-Indiana-Screaming-Eagles-Logos"),
    "Southern Miss": (34, 843, "Southern-Miss-Golden-Eagles-Logos"),
    "Southern Utah": (34, 844, "Southern-Utah-Thunderbirds-Logos"),
    "St. Bonaventure": (34, 848, "St-Bonaventure-Bonnies-Logos"),
    "St. Francis (PA)": (34, 821, "Saint-Francis-Red-Flash-Logos"),
    "St. Francis Brooklyn": (34, 849, "St-Francis-Terriers-Logos"),
    "St. John's": (34, 850, "St-Johns-Red-Storm-Logos"),
    "St. Thomas": (34, 6817, "St-Thomas-Tommies-Logos"),
    "Stanford": (34, 854, "Stanford-Cardinal-Logos"),
    "Stephen F. Austin": (34, 856, "Stephen-F-Austin-Lumberjacks-Logos"),
    "Stetson": (34, 857, "Stetson-Hatters-Logos"),
    "Stonehill": (34, 6861, "Stonehill-Skyhawks-Logos"),
    "Stony Brook": (34, 858, "Stony-Brook-Seawolves-Logos"),
    "Syracuse": (34, 859, "Syracuse-Orange-Logos"),
    "Tarleton State": (34, 6818, "Tarleton-Texans-Logos"),
    "TCU": (34, 868, "TCU-Horned-Frogs-Logos"),
    "Temple": (34, 860, "Temple-Owls-Logos"),
    "Tennessee": (34, 861, "Tennessee-Volunteers-Logos"),
    "Tennessee State": (34, 862, "Tennessee-State-Tigers-Logos"),
    "Tennessee Tech": (34, 863, "Tennessee-Tech-Golden-Eagles-Logos"),
    "Texas": (34, 865, "Texas-Longhorns-Logos"),
    "Texas A&M": (34, 866, "Texas-AM-Aggies-Logos"),
    "Texas A&M-Corpus Christi": (34, 867, "Texas-AM-CC-Islanders-Logos"),
    "Texas Southern": (34, 869, "Texas-Southern-Tigers-Logos"),
    "Texas State": (34, 847, "Texas-State-Bobcats-Logos"),
    "Texas Tech": (34, 870, "Texas-Tech-Red-Raiders-Logos"),
    "The Citadel": (34, 873, "The-Citadel-Bulldogs-Logos"),
    "Toledo": (34, 874, "Toledo-Rockets-Logos"),
    "Towson": (34, 875, "Towson-Tigers-Logos"),
    "Troy": (34, 876, "Troy-Trojans-Logos"),
    "Tulane": (34, 877, "Tulane-Green-Wave-Logos"),
    "Tulsa": (34, 878, "Tulsa-Golden-Hurricane-Logos"),
    "UAB": (35, 879, "UAB-Blazers-Logos"),
    "UC Davis": (30, 1831, "California-Davis-Aggies-Logos"),
    "UC Irvine": (30, 880, "California-Irvine-Anteaters-Logos"),
    "UC Riverside": (30, 881, "UC-Riverside-Highlanders-Logos"),
    "UC San Diego": (35, 6819, "UC-San-Diego-Tritons-Logos"),
    "UC Santa Barbara": (35, 883, "UCSB-Gauchos-Logos"),
    "UCLA": (35, 882, "UCLA-Bruins-Logos"),
    "UConn": (35, 884, "UConn-Huskies-Logos"),
    "UIC": (32, 708, "Illinois-Chicago-Flames-Logos"),
    "UL Monroe": (32, 733, "Louisiana-Monroe-Warhawks-Logos"),
    "UMBC": (35, 885, "UMBC-Retrievers-Logos"),
    "UMass Lowell": (35, 5023, "UMass-Lowell-River-Hawks-Logos"),
    "UNC Asheville": (33, 778, "North-CarolinaAsheville-Bulldogs-Logos"),
    "UNC Greensboro": (33, 779, "NC-Greensboro-Spartans-Logos"),
    "UNC Wilmington": (33, 780, "NC-Wilmington-Seahawks-Logos"),
    "UNLV": (35, 888, "UNLV-Rebels-Logos"),
    "USC": (34, 840, "Southern-California-Trojans-Logos"),
    "UT Arlington": (34, 871, "Texas-Arlington-Mavericks-Logos"),
    "UT Martin": (34, 864, "UT-Martin-Skyhawks-Logos"),
    "UT Rio Grande Valley": (35, 5639, "UTRGV-Vaqueros-Logos"),
    "Utah": (35, 892, "Utah-Utes-Logos"),
    "Utah State": (35, 893, "Utah-State-Aggies-Logos"),
    "Utah Tech": (35, 6866, "Utah-Tech-Trailblazers-Logos"),
    "Utah Valley": (35, 2606, "Utah-Valley-Wolverines-Logos"),
    "UTEP": (35, 889, "UTEP-Miners-Logos"),
    "UTSA": (34, 890, "Texas-SA-Roadrunners-Logos"),
    "Valparaiso": (35, 6820, "Valparaiso-Beacons-Logos"),
    "Vanderbilt": (35, 895, "Vanderbilt-Commodores-Logos"),
    "VCU": (35, 899, "Virginia-Commonwealth-Rams-Logos"),
    "Vermont": (35, 896, "Vermont-Catamounts-Logos"),
    "Villanova": (35, 897, "Villanova-Wildcats-Logos"),
    "Virginia": (35, 898, "Virginia-Cavaliers-Logos"),
    "Virginia Tech": (35, 901, "Virginia-Tech-Hokies-Logos"),
    "VMI": (35, 900, "VMI-Keydets-Logos"),
    "Wagner": (35, 902, "Wagner-Seahawks-Logos"),
    "Wake Forest": (35, 903, "Wake-Forest-Demon-Deacons-Logos"),
    "Washington": (35, 904, "Washington-Huskies-Logos"),
    "Washington State": (35, 905, "Washington-State-Cougars-Logos"),
    "Weber State": (35, 906, "Weber-State-Wildcats-Logos"),
    "West Georgia": (35, 6870, "West-Georgia-Wolves-Logos"),
    "West Virginia": (35, 907, "West-Virginia-Mountaineers-Logos"),
    "Western Carolina": (35, 2724, "Western-Carolina-Catamounts-Logos"),
    "Western Illinois": (35, 908, "Western-Illinois-Leathernecks-Logos"),
    "Western Kentucky": (35, 909, "Western-Kentucky-Hilltoppers-Logos"),
    "Western Michigan": (35, 910, "Western-Michigan-Broncos-Logos"),
    "Wichita State": (35, 911, "Wichita-State-Shockers-Logos"),
    "William & Mary": (35, 912, "William-and-Mary-Tribe-Logos"),
    "Winthrop": (35, 913, "Winthrop-Eagles-Logos"),
    "Wisconsin": (35, 914, "Wisconsin-Badgers-Logos"),
    "Wofford": (35, 916, "Wofford-Terriers-Logos"),
    "Wright State": (35, 917, "Wright-State-Raiders-Logos"),
    "Wyoming": (35, 918, "Wyoming-Cowboys-Logos"),
    "Xavier": (35, 919, "Xavier-Musketeers-Logos"),
    "Yale": (35, 920, "Yale-Bulldogs-Logos"),
    "Youngstown State": (35, 921, "Youngstown-State-Penguins-Logos"),
}

# Alias mappings (additional filenames that point to the same logo)
ALIASES = {
    "American University": "American",
    "Appalachian State": "App State",
    "IUPUI": "IU Indianapolis",
    "Loyola (IL)": "Loyola Chicago",
    "Loyola (MD)": "Loyola Maryland",
    "Maryland-Eastern Shore": "Maryland Eastern Shore",
    "McNeese": "McNeese State",
    "Miami (FL)": "Miami",
    "Nicholls": "Nicholls State",
    "Pennsylvania": "Penn",
    "Queens University": "Queens",
    "Sam Houston": "Sam Houston State",
    "San José State": "San Jose State",
    "SE Louisiana": "Southeastern Louisiana",
    "Seattle U": "Seattle",
    "St. Thomas-Minnesota": "St. Thomas",
    "Texas A&M-Commerce": "East Texas A&M",
    "UAlbany": "Albany",
    "UCF": "Central Florida",
}


def fetch_with_retry(url: str, max_retries: int = 4, retry_delay: float = 3.0) -> Optional[requests.Response]:
    """
    Fetches a URL with retry logic for 502 and other transient errors.

    Args:
        url: The URL to fetch
        max_retries: Maximum number of retry attempts
        retry_delay: Seconds to wait between retries

    Returns:
        The response object on success, or None if all retries fail
    """
    for attempt in range(max_retries):
        try:
            response = requests.get(url, headers=HEADERS, timeout=15)
            if response.status_code == 200:
                return response
            elif response.status_code in (502, 503, 429):
                # Transient errors - retry with backoff
                wait = retry_delay * (attempt + 1)
                print(f"  HTTP {response.status_code} on attempt {attempt + 1}, retrying in {wait:.0f}s...")
                time.sleep(wait)
            else:
                print(f"  HTTP {response.status_code} for {url}")
                return None
        except requests.exceptions.Timeout:
            print(f"  Timeout on attempt {attempt + 1}, retrying...")
            time.sleep(retry_delay)
        except Exception as e:
            print(f"  Error fetching {url}: {e}")
            return None
    print(f"  All {max_retries} retries exhausted for {url}")
    return None


def fetch_primary_logo_view_url(league_id: int, team_id: int, slug: str) -> Optional[str]:
    """
    Fetches the team logo list page and returns the view URL for the primary logo.

    Args:
        league_id: The SportsLogos.net league ID
        team_id: The SportsLogos.net team ID
        slug: The URL slug for the team

    Returns:
        The full URL for the primary logo view page, or None if not found
    """
    url = f"https://www.sportslogos.net/logos/list_by_team/{team_id}/{slug}/"

    response = fetch_with_retry(url)
    if not response:
        return None

    html = response.text

    # Find all view links for primary logos (not alternate, helmet, etc.)
    # Pattern: look for a link to /logos/view/{logo_id}/...Primary-Logo
    primary_pattern = re.compile(
        r'href="(/logos/view/\d+/[^"]*?Primary[^"]*?)"',
        re.IGNORECASE
    )
    matches = primary_pattern.findall(html)

    if matches:
        # Return the first (most recent) primary logo view URL
        return f"https://www.sportslogos.net{matches[0]}"

    # Fallback: try any logo view link
    fallback_pattern = re.compile(r'href="(/logos/view/(\d+)/[^"]*?)"')
    fallback_matches = fallback_pattern.findall(html)
    if fallback_matches:
        print(f"  Warning: No primary logo found, using first available logo")
        return f"https://www.sportslogos.net{fallback_matches[0][0]}"

    print(f"  Warning: No logo view links found for team {team_id}")
    return None


def fetch_full_logo_url(view_url: str) -> Optional[str]:
    """
    Fetches the logo view page and extracts the full-resolution PNG URL.

    Args:
        view_url: The URL of the logo view page on SportsLogos.net

    Returns:
        The direct URL to the full-resolution PNG image, or None if not found
    """
    response = fetch_with_retry(view_url)
    if not response:
        return None
    try:
        html = response.text

        # Extract the full-resolution PNG URL from content.sportslogos.net
        png_pattern = re.compile(
            r'https://content\.sportslogos\.net/logos/[^"\']+\.png',
            re.IGNORECASE
        )
        matches = png_pattern.findall(html)

        # Filter out thumbnail images (they contain /thumbs/ in the path)
        full_res = [m for m in matches if "/thumbs/" not in m]

        if full_res:
            return full_res[0]

        # Try without filtering if no full-res found
        if matches:
            return matches[0]

        # Try .gif if no PNG found
        gif_pattern = re.compile(
            r'https://content\.sportslogos\.net/logos/[^"\']+\.gif',
            re.IGNORECASE
        )
        gif_matches = gif_pattern.findall(html)
        full_gif = [m for m in gif_matches if "/thumbs/" not in m]
        if full_gif:
            print(f"  Warning: Only GIF found, using GIF format")
            return full_gif[0]

        print(f"  Warning: No image URLs found on view page {view_url}")
        return None
    except Exception as e:
        print(f"  Error parsing view page {view_url}: {e}")
        return None


def download_logo(logo_url: str, output_path: str) -> bool:
    """
    Downloads a logo image from the given URL and saves it to the output path.

    Args:
        logo_url: The direct URL to the logo image
        output_path: The local file path to save the image to

    Returns:
        True if successful, False otherwise
    """
    response = fetch_with_retry(logo_url)
    if not response:
        return False
    try:
        with open(output_path, "wb") as f:
            f.write(response.content)
        return True
    except Exception as e:
        print(f"  Error saving {output_path}: {e}")
        return False


def process_team(name: str, league_id: int, team_id: int, slug: str) -> bool:
    """
    Downloads the primary logo for a single team.

    Args:
        name: The display name / output filename for the team
        league_id: The SportsLogos.net league ID
        team_id: The SportsLogos.net team ID
        slug: The URL slug for the team

    Returns:
        True if the logo was downloaded successfully, False otherwise
    """
    print(f"\nProcessing: {name}")

    # Step 1: Get the primary logo view URL
    view_url = fetch_primary_logo_view_url(league_id, team_id, slug)
    if not view_url:
        print(f"  ERROR: Could not find primary logo view URL for {name}")
        return False
    print(f"  View URL: {view_url}")

    time.sleep(0.5)  # Be polite to the server

    # Step 2: Get the full-resolution PNG URL
    logo_url = fetch_full_logo_url(view_url)
    if not logo_url:
        print(f"  ERROR: Could not find full-resolution logo URL for {name}")
        return False
    print(f"  Logo URL: {logo_url}")

    # Determine file extension
    ext = ".png" if logo_url.endswith(".png") else ".gif"
    output_path = os.path.join(OUTPUT_DIR, f"{name}.png")

    time.sleep(0.5)  # Be polite to the server

    # Step 3: Download the logo
    if download_logo(logo_url, output_path):
        size = os.path.getsize(output_path)
        print(f"  SUCCESS: Saved to {output_path} ({size:,} bytes)")
        return True
    else:
        print(f"  ERROR: Failed to download logo for {name}")
        return False


def main() -> None:
    """
    Main function: downloads logos for all teams and creates aliases.
    """
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    success_count = 0
    fail_count = 0

    # Download logos for all teams
    for name, (league_id, team_id, slug) in TEAMS.items():
        output_path = os.path.join(OUTPUT_DIR, f"{name}.png")

        # Skip if already downloaded
        if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
            print(f"SKIP (exists): {name}")
            success_count += 1
            continue

        success = process_team(name, league_id, team_id, slug)
        if success:
            success_count += 1
        else:
            fail_count += 1

        time.sleep(1)  # Rate limiting between teams

    # Create alias copies
    print("\nCreating aliases...")
    for alias, source in ALIASES.items():
        source_path = os.path.join(OUTPUT_DIR, f"{source}.png")
        alias_path = os.path.join(OUTPUT_DIR, f"{alias}.png")

        if os.path.exists(source_path):
            shutil.copy2(source_path, alias_path)
            print(f"  Created alias: {alias}.png -> {source}.png")
        else:
            print(f"  WARNING: Source file not found for alias {alias} -> {source}")

    # Summary
    print(f"\n{'='*50}")
    print(f"COMPLETE: {success_count} succeeded, {fail_count} failed")
    print(f"Logos saved to: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
