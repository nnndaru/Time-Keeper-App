/**
 * The Timer class encapsulates all the logic and state for the countdown timer.
 */
class Timer {
  constructor() {
    this.totalSeconds = 0; // The initial total time set for the timer
    this.remainingSeconds = 0; // The current remaining time
    this.isRunning = false; // Flag to check if the timer is currently running
    this.intervalId = null; // Stores the ID returned by setInterval for clearing
    this.audioContext = null; // Web Audio API AudioContext for sound playback
    this.customAudioBuffer = null; // Stores decoded custom audio file
    this.selectedSound = 'beep'; // Currently selected alarm sound
    this.startTime = null; // Timestamp when the timer was started or resumed
    this.pausedTime = 0; // Accumulated paused time to maintain accuracy
    this.wakeLock = null; // Stores the wake lock object for screen control

    // Initialize DOM elements
    this.initializeElements();
    // Bind event listeners to controls
    this.bindEvents();
    // Update the display initially based on input values
    this.updateDisplay();
    // Set up handling for page visibility changes
    this.setupVisibilityHandling();
  }

  /**
   * Fetches and assigns references to all necessary DOM elements.
   */
  initializeElements() {
    this.timerDisplay = document.getElementById('timerDisplay');
    this.progressFill = document.getElementById('progressFill');
    this.minutesInput = document.getElementById('minutes');
    this.secondsInput = document.getElementById('seconds');
    this.startBtn = document.getElementById('startBtn');
    this.stopBtn = document.getElementById('stopBtn');
    this.resetBtn = document.getElementById('resetBtn');
    this.testBtn = document.getElementById('testBtn');
    this.alertModal = document.getElementById('alertModal');
    this.closeAlert = document.getElementById('closeAlert');
    this.soundSelect = document.getElementById('soundSelect');
    this.customSound = document.getElementById('customSound');
    this.uploadBtn = document.getElementById('uploadBtn');

    // References for new preset buttons
    this.preset5MinBtn = document.getElementById('preset5Min');
    this.preset15MinBtn = document.getElementById('preset15Min');
    this.preset25MinBtn = document.getElementById('preset25Min');
  }

  /**
   * Attaches event listeners to all interactive elements.
   */
  bindEvents() {
    this.startBtn.addEventListener('click', () => this.toggle());
    this.stopBtn.addEventListener('click', () => this.stop());
    this.resetBtn.addEventListener('click', () => this.reset());
    this.testBtn.addEventListener('click', () => this.testAlert());
    this.closeAlert.addEventListener('click', () => this.closeAlertModal());

    // Event listeners for sound selection
    this.soundSelect.addEventListener('change', () => this.handleSoundChange());
    this.customSound.addEventListener('change', () => this.handleCustomSound());
    this.uploadBtn.addEventListener('click', () => this.customSound.click());

    // Update timer when input fields change (only if not running)
    [this.minutesInput, this.secondsInput].forEach((input) => {
      input.addEventListener('change', () => {
        if (!this.isRunning) {
          this.setTime();
        }
      });
    });

    // Event listeners for new preset buttons
    this.preset5MinBtn.addEventListener('click', () => this.setPreset(5));
    this.preset15MinBtn.addEventListener('click', () => this.setPreset(15));
    this.preset25MinBtn.addEventListener('click', () => this.setPreset(25));
  }

  /**
   * Sets up event listeners for page visibility and window focus/blur.
   * This helps synchronize the timer when the page is brought back into focus,
   * accounting for potential browser throttling in background tabs.
   */
  setupVisibilityHandling() {
    document.addEventListener('visibilitychange', () => {
      if (this.isRunning) {
        this.syncTimer();
      }
    });

    window.addEventListener('focus', () => {
      if (this.isRunning) {
        this.syncTimer();
      }
    });

    window.addEventListener('blur', () => {
      if (this.isRunning) {
        this.syncTimer();
      }
    });
  }

  /**
   * Requests a screen wake lock to prevent the screen from turning off.
   * This is useful to ensure the alarm plays even if the user isn't actively interacting.
   * Requires user gesture to activate.
   */
  async requestWakeLock() {
    // Check if Wake Lock API is supported by the browser
    if ('wakeLock' in navigator) {
      try {
        // Request a 'screen' wake lock
        this.wakeLock = await navigator.wakeLock.request('screen');
        console.log('Screen Wake Lock acquired!');
        // Add a listener for when the wake lock is released by the system
        this.wakeLock.addEventListener('release', () => {
          console.log('Screen Wake Lock released!');
          this.wakeLock = null; // Clear the reference
        });
      } catch (err) {
        // Handle errors (e.g., user denied permission, system limitations)
        if (err.name === 'NotAllowedError') {
          console.error(
            `Wake Lock Error: ${err.name} - ${err.message}. This usually means the page needs to be served over HTTPS and/or user permission is required.`
          );
        } else {
          console.error(`Wake Lock Error: ${err.name}, ${err.message}`);
        }
      }
    } else {
      console.warn('Wake Lock API not supported in this browser.');
    }
  }

  /**
   * Releases any active screen wake lock.
   */
  releaseWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release();
      this.wakeLock = null; // Clear the reference
      console.log('Screen Wake Lock released programmatically.');
    }
  }

  /**
   * Synchronizes the timer's remaining time based on the actual elapsed time.
   * This accounts for discrepancies caused by browser throttling or tab changes.
   */
  syncTimer() {
    if (!this.isRunning || !this.startTime) return;

    const now = Date.now();
    // Calculate time elapsed since the timer started/resumed
    const elapsed = Math.floor((now - this.startTime) / 1000);
    // Calculate new remaining seconds considering total time and paused time
    const newRemainingSeconds = this.totalSeconds - elapsed - this.pausedTime;

    if (newRemainingSeconds <= 0) {
      // If time is up, complete the timer
      this.remainingSeconds = 0;
      this.complete();
    } else {
      // Otherwise, update remaining time and display
      this.remainingSeconds = newRemainingSeconds;
      this.updateDisplay();
      this.updateProgress();
    }
  }

  /**
   * Sets the total and remaining time for the timer based on input fields.
   */
  setTime() {
    const minutes = parseInt(this.minutesInput.value) || 0;
    const seconds = parseInt(this.secondsInput.value) || 0;

    // Calculate total seconds (minutes * 60 + seconds)
    this.totalSeconds = minutes * 60 + seconds;
    this.remainingSeconds = this.totalSeconds;
    this.pausedTime = 0; // Reset paused time when setting new total

    this.updateDisplay();
    this.updateProgress();
  }

  /**
   * Sets the timer to a predefined number of minutes.
   * @param {number} minutes The number of minutes for the preset.
   */
  setPreset(minutes) {
    this.minutesInput.value = minutes;
    this.secondsInput.value = 0;
    this.setTime(); // Update the timer's internal state
    this.reset(); // Reset the timer to apply the new preset and refresh display
  }

  /**
   * Toggles the timer between start/pause states.
   */
  toggle() {
    if (this.isRunning) {
      this.pause();
    } else {
      this.start();
    }
  }

  /**
   * Starts the countdown timer.
   */
  start() {
    // If remaining time is 0, set time from inputs before starting
    if (this.remainingSeconds <= 0) {
      this.setTime();
    }

    // Only start if there's time to count down
    if (this.remainingSeconds > 0) {
      this.isRunning = true;
      this.startTime = Date.now(); // Record start time for accurate tracking
      this.startBtn.textContent = 'Pause';
      this.startBtn.className = 'stop-btn'; // Change button style to indicate pause

      this.requestWakeLock(); // Request screen wake lock

      // Set up interval to update timer frequently (100ms for smoother progress bar)
      this.intervalId = setInterval(() => {
        this.syncTimer(); // Use syncTimer to handle potential throttling
      }, 100);
    }
  }

  /**
   * Pauses the countdown timer.
   */
  pause() {
    this.isRunning = false;
    this.startBtn.textContent = 'Start';
    this.startBtn.className = 'start-btn'; // Change button style back to start

    this.releaseWakeLock(); // Release screen wake lock

    // Clear the interval to stop the timer
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Accumulate paused time if the timer was running before pause
    if (this.startTime) {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      this.pausedTime += elapsed;
    }
  }

  /**
   * Stops the timer and resets it to its initial set time.
   */
  stop() {
    this.pause(); // Pause any active timer
    this.remainingSeconds = this.totalSeconds; // Reset to initial total
    this.pausedTime = 0; // Clear paused time
    this.startTime = null; // Clear start timestamp
    this.updateDisplay(); // Update display
    this.updateProgress(); // Reset progress bar
  }

  /**
   * Resets the timer to its initial configured state (from inputs).
   */
  reset() {
    this.pause(); // Pause any active timer
    this.pausedTime = 0; // Clear paused time
    this.startTime = null; // Clear start timestamp
    this.setTime(); // Re-read inputs and set timer
    this.timerDisplay.classList.remove('alert'); // Remove alert styling
  }

  /**
   * Handles the completion of the timer (when remainingSeconds reaches 0).
   */
  complete() {
    this.pause(); // Pause the timer
    this.remainingSeconds = 0; // Ensure display shows 00:00
    this.updateDisplay();
    this.updateProgress();
    this.timerDisplay.classList.add('alert'); // Add alert styling
    this.playAlert(); // Play selected alarm sound
    this.showAlert(); // Show custom alert modal
    this.releaseWakeLock(); // Release screen wake lock
  }

  /**
   * Updates the timer display with formatted minutes and seconds.
   */
  updateDisplay() {
    const minutes = Math.floor(this.remainingSeconds / 60);
    const seconds = this.remainingSeconds % 60;

    // Format as MM:SS (e.g., 05:30)
    this.timerDisplay.textContent = `${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Updates the width of the progress bar based on elapsed time.
   */
  updateProgress() {
    if (this.totalSeconds > 0) {
      const progress =
        ((this.totalSeconds - this.remainingSeconds) / this.totalSeconds) * 100;
      this.progressFill.style.width = `${progress}%`;
    } else {
      this.progressFill.style.width = '0%'; // No progress if total time is 0
    }
  }

  /**
   * Plays the currently selected alarm sound.
   */
  async playAlert() {
    // Attempt to resume audio context if it's suspended due to autoplay policy
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    switch (this.selectedSound) {
      case 'custom':
        if (this.customAudioBuffer) {
          await this.playCustomSound();
        } else {
          this.playBeepSound(); // Fallback to beep if custom sound fails or not loaded
        }
        break;
      case 'bell':
        await this.playBellSound();
        break;
      case 'horn':
        await this.playHornSound();
        break;
      default:
        this.playBeepSound(); // Default beep sound
    }
  }

  /**
   * Plays the loaded custom audio buffer.
   */
  async playCustomSound() {
    try {
      // Create AudioContext on first play if not already created (user gesture required)
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext ||
          window.webkitAudioContext)();
      }

      // Ensure context is running, especially if created outside a direct user gesture
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      if (!this.customAudioBuffer) {
        console.warn('No custom audio buffer loaded. Playing default beep.');
        this.playBeepSound(); // Fallback if custom sound not ready
        return;
      }

      const source = this.audioContext.createBufferSource();
      const gainNode = this.audioContext.createGain();

      source.buffer = this.customAudioBuffer;
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      gainNode.gain.setValueAtTime(0.7, this.audioContext.currentTime); // Set volume
      source.start(); // Play the sound
    } catch (error) {
      console.error('Error playing custom sound:', error);
      this.playBeepSound(); // Fallback on error
    }
  }

  /**
   * Generates and plays a bell-like sound using Web Audio API.
   */
  async playBellSound() {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext ||
          window.webkitAudioContext)();
      }
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Create multiple oscillators for a richer, bell-like harmonic sound
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          const oscillator = this.audioContext.createOscillator();
          const gainNode = this.audioContext.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(this.audioContext.destination);

          // Different frequencies for harmonic effect
          oscillator.frequency.setValueAtTime(
            523 + i * 100, // Base frequency + harmonics
            this.audioContext.currentTime
          );
          gainNode.gain.setValueAtTime(
            0.2 / (i + 1), // Decrease gain for higher harmonics
            this.audioContext.currentTime
          );
          // Exponential decay for the bell sound
          gainNode.gain.exponentialRampToValueAtTime(
            0.01,
            this.audioContext.currentTime + 2
          );

          oscillator.start();
          oscillator.stop(this.audioContext.currentTime + 2); // Stop after 2 seconds
        }, i * 200); // Stagger the starts of each harmonic
      }
    } catch (error) {
      console.error('Error playing bell sound:', error);
      this.playBeepSound(); // Fallback on error
    }
  }

  /**
   * Generates and plays an air horn-like sound using Web Audio API.
   */
  async playHornSound() {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext ||
          window.webkitAudioContext)();
      }
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // Frequency sweep for air horn effect
      oscillator.frequency.setValueAtTime(
        200, // Starting frequency
        this.audioContext.currentTime
      );
      oscillator.frequency.linearRampToValueAtTime(
        400, // Ending frequency
        this.audioContext.currentTime + 0.1
      );
      oscillator.frequency.setValueAtTime(
        400, // Hold frequency
        this.audioContext.currentTime + 1
      );

      gainNode.gain.setValueAtTime(0.5, this.audioContext.currentTime); // Set initial volume
      // Exponential decay for the horn sound
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + 1
      );

      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 1); // Stop after 1 second
    } catch (error) {
      console.error('Error playing horn sound:', error);
      this.playBeepSound(); // Fallback on error
    }
  }

  /**
   * Generates and plays a simple beep sound using Web Audio API.
   */
  playBeepSound() {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext ||
          window.webkitAudioContext)();
      }
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.setValueAtTime(
        800, // Beep frequency
        this.audioContext.currentTime
      );
      gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime); // Set volume

      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.5); // Stop after 0.5 seconds
    } catch (error) {
      console.error('Audio playback not supported or failed:', error);
    }
  }

  /**
   * Handles the change in sound selection (shows/hides custom sound upload).
   */
  handleSoundChange() {
    this.selectedSound = this.soundSelect.value;

    // Show/hide custom sound input and upload button based on selection
    if (this.selectedSound === 'custom') {
      this.customSound.style.display = 'inline';
      this.uploadBtn.style.display = 'inline';
    } else {
      this.customSound.style.display = 'none';
      this.uploadBtn.style.display = 'none';
    }
  }

  /**
   * Handles the selection and decoding of a custom audio file.
   */
  async handleCustomSound() {
    const file = this.customSound.files[0];
    if (!file) return;

    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext ||
          window.webkitAudioContext)();
      }

      const arrayBuffer = await file.arrayBuffer();
      // Decode audio data into an AudioBuffer
      this.customAudioBuffer = await this.audioContext.decodeAudioData(
        arrayBuffer
      );

      console.log('Custom sound loaded successfully');
    } catch (error) {
      console.error('Error loading custom sound:', error);
      // Display a custom alert modal instead of browser's alert()
      this.showAlert(
        'Error Loading Sound',
        'Failed to load audio file. Please try a different one.'
      );
    }
  }

  /**
   * Shows the custom alert modal.
   * @param {string} title The title for the alert.
   * @param {string} message The message content for the alert.
   */
  showAlert(title = "⏰ Time's Up!", message = 'Your timer has finished!') {
    document.querySelector('#alertModal .alert-content h2').textContent = title;
    document.querySelector('#alertModal .alert-content p').textContent =
      message;
    this.alertModal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Prevent body scrolling
  }

  /**
   * Closes the custom alert modal.
   */
  closeAlertModal() {
    this.alertModal.style.display = 'none';
    document.body.style.overflow = 'auto'; // Re-enable body scrolling
    this.timerDisplay.classList.remove('alert'); // Remove alert animation
  }

  /**
   * Tests the alarm sound and shows the alert modal.
   */
  testAlert() {
    this.playAlert();
    this.showAlert(
      'Test Alarm',
      'This is a test of your selected alarm sound!'
    );
  }
}

// Initialize the timer when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  new Timer();
});
