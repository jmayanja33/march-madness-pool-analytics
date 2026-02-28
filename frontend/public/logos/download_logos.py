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
}

# Alias mappings (additional filenames that point to the same logo)
ALIASES = {
    "American University": "American",
    "Appalachian State": "App State",
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
