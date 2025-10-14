//const audioElement = document.getElementById('audio-player');
const audioPlayer = document.getElementById('audioPlayer');
const progressBar = document.getElementById('progress');
const progressContainer = document.getElementById('progressContainer');
const currentTimeEl = document.getElementById('currentTime');
const totalTimeEl = document.getElementById('totalTime');
const uploadStatus = document.getElementById('status');
const playBtn = document.getElementById('playBtn');

let artistWindow = null;

document.getElementById('authors').addEventListener('click', () => {
  if(artistWindow && !artistWindow.closed) {
    artistWindow.focus();
    return;
  }

  artistWindow = window.open(
    './authors.html',
    'authorsWindow',
    'width=480,height=320,resizable=yes'
  );
});

window.addEventListener('message', (event) => {
  if(event.data.type === 'request-artists') {
    if (artistWindow && !artistWindow.closed) {
      const artists = [...new Set(allSongs.map(song => song.artist))]
      artistWindow.postMessage({
        type: 'artists',
        artists: artists
      }, '*');
    }
  } else if (event.data.type === 'artist-selected') {
    const selectedArtist = event.data.artist;
    currentFilter = selectedArtist;
    currentSongs = getFilteredSongs();
    console.log(`Filtered to artist: ${selectedArtist}, ${currentSongs.length} songs`);

    currentIndex = -1;
    audioPlayer.pause();
    audioPlayer.src = '';
    updatePlayIcon(false);

    if(selectedArtist === 'all') {
      updateNowPlayingDisplayAdvanced('All Artist - Ready to play');
    } else {
      updateNowPlayingDisplayAdvanced(`${selectedArtist} - ${currentSongs.length} songs`);
    }
  }
});

audioPlayer.addEventListener('timeupdate', () => {
  const now = Date.now();
  if (now - lastTimeUpdate < TIME_UPDATE_THROTTLE) return;
  lastTimeUpdate = now;
  if (audioPlayer.duration) {
    const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    progressBar.style.width = percent + '%';
    currentTimeEl.textContent = formatDuration(audioPlayer.currentTime);
  }
});

audioPlayer.addEventListener('loadedmetadata', () => {
  totalTimeEl.textContent = formatDuration(audioPlayer.duration);
});

progressContainer.addEventListener('click', (e) => {
  const width = progressContainer.clientWidth;
  const clickX = e.offsetX;
  const duration = audioPlayer.duration;
  if (duration) {
    audioPlayer.currentTime = (clickX / width) * duration;
  }
});

// authorSelect.addEventListener("change", (e) => {
//   const selectedValue = authorSelect.value;
//   currentFilter = selectedValue;
//   currentSongs = getFilteredSongs();
//   displaySongs(currentSongs);
// })

let allSongs = [];
let currentIndex = -1;
let currentFilter = "all";
let currentSongs = [];
//const songList = document.getElementById('songList');
let isLoadingSong = false;
let lastTimeUpdate = 0;
const TIME_UPDATE_THROTTLE = 100; // Update every 100ms instead of every frame

/* button event handlers */

document.querySelector('.minimize').addEventListener('click', () => {
  console.log('minimize');
  window.electronAPI.windowControl('minimize');
});

document.querySelector('.maximize').addEventListener('click', () => {
  console.log('maximize');
  window.electronAPI.windowControl('maximize');
});

document.querySelector('.close').addEventListener('click', () => {
  console.log('close');
  window.electronAPI.windowControl('close');
});

audioPlayer.addEventListener('play', () => {
  if (!isLoadingSong) {
    updatePlayIcon(true);
  }
});

audioPlayer.addEventListener('pause', () => {
  if (!isLoadingSong) {
    updatePlayIcon(false);
  }
});

audioPlayer.addEventListener('ended', () => {
  if (!isLoadingSong) {
    playNext();
  }
});

document.querySelectorAll('.controls .btn')[1].addEventListener('click', playPrev);
document.querySelectorAll('.controls .btn')[2].addEventListener('click', togglePlayPause);
document.querySelectorAll('.controls .btn')[3].addEventListener('click', playNext);

// function populateAuthorDropdown(songs) {
//   const artists = [...new Set(songs.map(song => song.artist))];
//   const fragment = document.createDocumentFragment();
//   authorSelect.innerHTML = `<option value="all">All Authors</option>`;

//   artists.forEach(author => {
//     const option = document.createElement("option");
//     option.value = author;
//     option.textContent = author;
//     fragment.appendChild(option);
//   });
//   authorSelect.appendChild(fragment);
// }

async function playSong(index) {
  if (index < 0 || index >= currentSongs.length) return;
  if (isLoadingSong) return; // Prevent overlapping loads

  isLoadingSong = true; // Set flag immediately
  currentIndex = index;
  const song = currentSongs[index];

  try {
    const base64Audio = await window.electronAPI.loadAudio(song.filePath);
    const dataUrl = `data:audio/mpeg;base64,${base64Audio}`;
    audioPlayer.src = dataUrl;

    try {
      await audioPlayer.play();
      updateNowPlayingDisplayAdvanced(song.title);
      updatePlayIcon(true);
    } catch (playErr) {
      console.log('Playback interrupted:', playErr.message);
      updatePlayIcon(false);
    }
  } catch (error) {
    showStatus('Error playing song', 'error');
    console.error('Failed to load song:', error);
  } finally {
    isLoadingSong = false; // Always reset the flag
  }
}

function updatePlayIcon(isPlaying) {
  playBtn.innerHTML = isPlaying
    ? `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14z M14 5v14h4V5h-4z" transform="scale(-1,1) translate(-24,0)" /></svg>`
    : `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>`
}

function playNext() {
  if (currentSongs.length === 0) return;
  if (isLoadingSong) return; // Don't advance while loading
  let nextIndex = (currentIndex + 1) % currentSongs.length;
  playSong(nextIndex);
}

function playPrev() {
  if (currentSongs.length === 0) return;
  if (isLoadingSong) return; // Don't go back while loading
  let prevIndex = (currentIndex - 1 + currentSongs.length) % currentSongs.length;
  playSong(prevIndex);
}

function handleSongClick(index) {
  if (isLoadingSong) return;
  if (currentIndex === index && !audioPlayer.paused) {
    audioPlayer.pause();
    updatePlayIcon(false);
  } else {
    playSong(index);
  }
}

function togglePlayPause() {
  if (currentSongs.length === 0) return;
  if (isLoadingSong) return;

  // If no song is loaded yet, start playing the first song
  if (!audioPlayer.src || audioPlayer.src === '') {
    playSong(0);
    return;
  }

  // If there's a song loaded, toggle play/pause
  if (audioPlayer.paused) {
    audioPlayer.play().catch(err => {
      console.log('Play was prevented:', err.message);
    });
  } else {
    audioPlayer.pause();
  }
}

function updateNowPlayingDisplayAdvanced(songTitle) {
  const display = document.querySelector('.display');

  const scrollingText = document.createElement('span');
  scrollingText.className = 'scrolling-text';
  scrollingText.textContent = `🎵 Now Playing: "${songTitle}"`;

  display.innerHTML = '';
  display.appendChild(scrollingText);

  // Use requestIdleCallback for non-critical DOM measurements
  const measureAndAnimate = () => {
    const displayWidth = display.offsetWidth;
    const textWidth = scrollingText.offsetWidth;

    if (textWidth > displayWidth) {
      display.classList.add('should-scroll');

      const baseDuration = 15;
      const lengthMultiplier = Math.max(1, songTitle.length / 30);
      const duration = baseDuration * lengthMultiplier;
      scrollingText.style.animationDuration = `${duration}s`;
    } else {
      display.classList.remove('should-scroll');
    }
  };

  if (window.requestIdleCallback) {
    requestIdleCallback(measureAndAnimate);
  } else {
    setTimeout(measureAndAnimate, 100);
  }
}

function formatDuration(seconds) {
  if (!seconds || seconds === 0) return 'Unknown';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function showStatus(message, type) {
  uploadStatus.textContent = message;
  uploadStatus.className = `status ${type}`;
  uploadStatus.style.display = 'block';

  setTimeout(() => {
    uploadStatus.style.display = 'none';
  }, 3000);
}

function debounceResize() {
  // Placeholder - will implement window resizing later
}

function getFilteredSongs() {
  if (currentFilter === "all") {
    return allSongs;
  } else {
    return allSongs.filter(song => song.artist === currentFilter);
  }
}

async function loadAllFiles() {
  try {
    console.log('Loading all songs...')
    const songs = await window.electronAPI.loadAllFiles();
    allSongs = songs;
    currentSongs = getFilteredSongs();
    console.log(`Loaded ${allSongs.length} songs:`, allSongs);
    return songs;
  } catch (error) {
    console.error('Error loading files:', error);
    alert('Could not load audio file');
  }
}

function scrollToActiveSongSimple() {
  if (currentIndex >= 0 && currentIndex < currentSongs.length) {
    const activeSongElement = songList.children[currentIndex];
    if (activeSongElement) {
      activeSongElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    }
  }
}

async function deleteSong(song) {
  console.log('Delete function not yet implemented for:', song.title);
  // Will implement in next phase
}

window.electronAPI.onMusicEvents((events) => {
  console.log('Music folder changed - events received:', events);

  loadAllFiles();

  events.forEach(event => {
    if (event.type === 'add') {
      console.log('➕ New file added:', event.path);
    } else if (event.type === 'unlink') {
      console.log('🗑️ File removed:', event.path);
    } else if (event.type === 'change') {
      console.log('✏️ File changed:', event.path);
    }
  });
  loadAllFiles();
});

document.addEventListener('DOMContentLoaded', () => {
  loadAllFiles();
});