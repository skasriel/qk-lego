#!/usr/bin/env python3
"""
Download LEGO MPD/LDR files from Seymouria and LDraw.org, 
and fetch corresponding set images from Brickset.
Stores everything in server/sets/ directory.
"""

import os
import re
import json
import time
import requests
from pathlib import Path
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup

# Configuration
BASE_DIR = Path(__file__).parent / "server" / "sets"
BASE_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
}

def download_file(url, dest_path, skip_existing=True):
    """Download a file from URL to destination path."""
    if skip_existing and dest_path.exists():
        print(f"  Skipping (exists): {dest_path.name}")
        return True
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=30)
        response.raise_for_status()
        
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        with open(dest_path, 'wb') as f:
            f.write(response.content)
        
        print(f"  ✓ Downloaded: {dest_path.name} ({len(response.content)} bytes)")
        return True
    except Exception as e:
        print(f"  ✗ Failed: {url} - {e}")
        return False

def get_brickset_image(set_num):
    """Get set image URL and metadata from Brickset."""
    url = f"https://brickset.com/sets/{set_num}-1"
    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        response.raise_for_status()
        
        # Extract metadata
        metadata = {}
        
        # Look for the main set image
        match = re.search(r'https://images\.brickset\.com/sets/images/(\d+)-1\.jpg', response.text)
        if match:
            metadata['image_url'] = f"https://images.brickset.com/sets/images/{set_num}-1.jpg"
        
        # Extract full name from title tag
        title_match = re.search(r'<title>LEGO (\d+) ([^<|]+)', response.text)
        if title_match:
            metadata['name'] = title_match.group(2).strip()
        
        # Extract year
        year_match = re.search(r'<dt>Year released</dt>\s*<dd><a[^>]*>(\d{4})</a>', response.text)
        if year_match:
            metadata['year'] = int(year_match.group(1))
        
        # Extract theme
        theme_match = re.search(r'<dt>Theme</dt>\s*<dd><a[^>]*>([^<]+)</a>', response.text)
        if theme_match:
            metadata['theme'] = theme_match.group(1).strip()
        
        # Extract theme group
        theme_group_match = re.search(r'<dt>Theme group</dt>\s*<dd>([^<]+)</dd>', response.text)
        if theme_group_match:
            metadata['theme_group'] = theme_group_match.group(1).strip()
        
        # Extract pieces
        pieces_match = re.search(r'<dt>Pieces</dt>\s*<dd><a[^>]*>(\d+)</a>', response.text)
        if pieces_match:
            metadata['pieces'] = int(pieces_match.group(1))
        
        # Extract minifigures
        minifig_match = re.search(r'<dt>Minifigs</dt>\s*<dd>(\d+)</dd>', response.text)
        if minifig_match:
            metadata['minifigures'] = int(minifig_match.group(1))
        
        return metadata if metadata else None
    except Exception as e:
        print(f"    Warning: Could not fetch metadata for {set_num}: {e}")
        return None

def scrape_seymouria():
    """Scrape Seymouria for official LEGO set LDR files."""
    print("\n=== Scraping Seymouria.pl ===")
    base_url = "https://seymouria.pl/Download/official-lego-sets-ldr.php"
    
    try:
        response = requests.get(base_url, headers=HEADERS, timeout=30)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Find all links to .ldr or .mpd files
        links = []
        for a in soup.find_all('a', href=True):
            href = a['href']
            if href.lower().endswith(('.ldr', '.mpd', '.zip')):
                full_url = urljoin(base_url, href)
                # Extract set number from filename if possible
                filename = os.path.basename(urlparse(href).path)
                set_match = re.search(r'(\d{4,5})', filename)
                set_num = set_match.group(1) if set_match else None
                links.append((full_url, filename, set_num))
        
        print(f"Found {len(links)} files on Seymouria")
        
        for url, filename, set_num in links:  # Process all files
            print(f"\nProcessing: {filename}")
            
            # Create directory for this set
            if set_num:
                set_dir = BASE_DIR / set_num
            else:
                set_dir = BASE_DIR / "misc"
            
            # Download the LDR/MPD file
            dest_file = set_dir / filename
            metadata = None
            if download_file(url, dest_file):
                # Try to get image and metadata from Brickset if we have a set number
                if set_num:
                    metadata = get_brickset_image(set_num)
                    if metadata and 'image_url' in metadata:
                        img_dest = set_dir / f"{set_num}.jpg"
                        download_file(metadata['image_url'], img_dest)
                    
                    # Save metadata to JSON file
                    if metadata:
                        meta_file = set_dir / "metadata.json"
                        import json
                        with open(meta_file, 'w') as f:
                            json.dump(metadata, f, indent=2)
                        print(f"  ✓ Saved metadata: {metadata.get('theme', 'N/A')} ({metadata.get('year', 'N/A')}), {metadata.get('pieces', 'N/A')} pieces")
            
            time.sleep(0.5)  # Be polite to the server
            
    except Exception as e:
        print(f"Error scraping Seymouria: {e}")

def scrape_ldraw_official():
    """Scrape LDraw.org for official models."""
    print("\n=== Scraping LDraw.org ===")
    # LDraw official models are typically in specific directories
    # This is a simplified version - would need to be expanded based on actual structure
    
    base_url = "https://library.ldraw.org/official/"
    
    try:
        # Get list of official models (this would need to be adapted based on actual site structure)
        response = requests.get(base_url, headers=HEADERS, timeout=30)
        # Implementation would depend on actual site structure
        print("LDraw.org scraping would go here - requires site-specific parsing")
        
    except Exception as e:
        print(f"Error scraping LDraw.org: {e}")

def create_index():
    """Create an index JSON file of all downloaded sets."""
    print("\n=== Creating Index ===")
    
    index = {}
    
    for set_dir in BASE_DIR.iterdir():
        if not set_dir.is_dir():
            continue
        
        set_num = set_dir.name
        files = list(set_dir.glob('*'))
        
        mpd_files = [f.name for f in files if f.suffix.lower() in ['.mpd', '.ldr']]
        img_files = [f.name for f in files if f.suffix.lower() in ['.jpg', '.png', '.jpeg']]
        
        if mpd_files or img_files:
            # Load metadata if available
            metadata_file = set_dir / 'metadata.json'
            metadata = {}
            if metadata_file.exists():
                try:
                    with open(metadata_file, 'r') as f:
                        metadata = json.load(f)
                except:
                    pass
            
            index[set_num] = {
                'mpd_files': mpd_files,
                'images': img_files,
                'path': str(set_dir.relative_to(BASE_DIR.parent)),
                **metadata  # Include year, theme, pieces, etc.
            }
    
    index_file = BASE_DIR / 'index.json'
    with open(index_file, 'w') as f:
        json.dump(index, f, indent=2)
    
    print(f"Created index with {len(index)} sets at {index_file}")

def main():
    print("LEGO Sets Downloader")
    print("=" * 50)
    print(f"Downloading to: {BASE_DIR}")
    
    # Create directories
    (BASE_DIR / 'seymouria').mkdir(exist_ok=True)
    (BASE_DIR / 'ldraw_official').mkdir(exist_ok=True)
    
    # Scrape sources
    scrape_seymouria()
    scrape_ldraw_official()
    
    # Create index
    create_index()
    
    print("\n" + "=" * 50)
    print("Done! Check the server/sets/ directory for downloaded files.")

if __name__ == '__main__':
    main()