// Enums to be used in extension
enum Signal {
    EEG,
    EMG,
    ECG,
    EOG
}

enum Cue {
    none,
    visual,
    audio
}

enum LookingAt {
    none,
    up,
    left,
    right,
    down,
    blink
}

//% color="#E69138" icon="\uf188" weight=90
namespace neurobit {

    /**
     * Return pin to record EEG
     */

    //% group="Signal"
    //% weight=50 
    //% block="EEG"
    export function eeg(): number {
        return pins.analogReadPin(AnalogPin.P0);
    }


    /**
     * Return pin to record EMG
     */

    //% group="Signal"
    //% weight=49 
    //% block="EMG"
    export function emg(): number {
        return pins.analogReadPin(AnalogPin.P0);
    }


    /**
     * Return pin to record ECG
     */

    //% group="Signal"
    //% weight=48
    //% block="ECG"
    export function ecg(): number {
        return pins.analogReadPin(AnalogPin.P1);
    }

    /**
     * Return pin to record EOG
     */

    //% group="Signal"
    //% weight=47
    //% block="EOG"
    export function eog(): number {
        return pins.analogReadPin(AnalogPin.P0);
    }

    /**
     * Return the maximum threshold from some time intervals(ms).
     * As an optional argument, you can change the percentage of threshold
     * to be returned. The defaulut is 100(%).
     * @param ms = duration(ms) to run the get and caluculate max theshold.
     * @param percent (optional) = number as percentage of threshold to be returned. The default is 100%.
     */

    //% group="EMG"
    //% weight=46
    //% block="get threshold from $ms ms || and return with $percent percent"
    //% expandableArgumentMode="enable"
    //% ms.shadow=timePicker
    //% percent.defl=100
    export function getThreshold(ms: number, percent?: number) {
        const startTimer = control.millis();
        let val = 0;
        let max_val = 0;

        while (control.millis() - startTimer < ms) {
            val = emg();

            if (max_val < val) {
                max_val = val;
            }
        }

        return max_val * (percent / 100);
    }


    /**
     * Return the number of spikes that happened during some duration(ms).
     * You can also change the duration but the default is 3000 (i.e. 3 seconds).
     * If you grip tight for minimum 500ms (then release), 
     * it will return as -1. 
     * @param ms = duration(ms) to run the spike recording.
     */

    //% group="EMG"
    //% weight=45
    //% block="count spikes for $ms ms"
    //% ms.shadow=timePicker
    //% ms.defl=3000
    export function countSpikes(ms: number) {
        const down_sample_fs = 200;
        const period = 1000000 / down_sample_fs;
        let elapsed_time = 0;
        let elapsed_time2 = 0;

        const buffer_size = 20;
        let buffer: number[] = [];

        // Smoothing function for signal
        function movingAverage(data: number[], windowSize: number): number {
            let sum = 0;
            let smoothedData = 0;
            for (let j = 0; j < windowSize; j++) {
                sum += data[j];
            }
            smoothedData = sum / windowSize;
            return smoothedData;
        }

        const threshold = 150;
        const interval = 500;
        let signal = 0;
        let smooth_signal = 0;
        let counter = 0;
        let checking = false;
        let check_time = -interval;
        let check_grip = false;

        const startTimer = control.millis();
        let sample_time = input.runningTimeMicros();

        // Begin Timer
        while (control.millis() - startTimer < ms) {
            signal = emg();

            // Fill the buffer before the main process
            if (buffer.length < buffer_size) {
                buffer.push(signal);
            }

            // Once the buffer fills up, shift
            if (buffer.length == buffer_size) {
                buffer.shift();
                buffer.push(signal);

                // Smooth out the signal
                smooth_signal = movingAverage(buffer, buffer.length);

                // Check the signal above threshold
                let sample_time2 = input.runningTimeMicros();
                while (smooth_signal > threshold) {
                    signal = emg();

                    buffer.shift();
                    buffer.push(signal);

                    smooth_signal = movingAverage(buffer, buffer.length);

                    if (!checking) {
                        // Record the time when the spike is detected
                        // for only once at the beggining during the rising
                        check_time = control.millis();
                        checking = true;
                    }

                    // Checking for grip
                    check_grip = true;

                    elapsed_time2 = input.runningTimeMicros() - sample_time2;

                    if (elapsed_time2 < period) {
                        control.waitMicros(period - elapsed_time2);
                    }

                    sample_time2 = input.runningTimeMicros();
                }

                // Once signl drops down below the threshold, allow 
                // check (for spike) to happen
                checking = false;

                // Check if the spike is within the interval window
                // to reduce false positives
                if (control.millis() - check_time < interval) {
                    check_grip = false;
                    counter++; // Increment counter for detected spikes
                    check_time = -interval; // Reset check time
                }

                // If the signal goes over one second, assume due to
                // the grip
                if (check_grip) {
                    counter = -1;
                }

            }

            // Sampling Rate caluculation
            elapsed_time = input.runningTimeMicros() - sample_time;

            if (elapsed_time < period) {
                control.waitMicros(period - elapsed_time);
            }

            sample_time = input.runningTimeMicros();
        }

        return counter; // Return the spike count
    }


    /**
     * Give the reaction time from certain cue. User have options to
     * choose either from visual (Heart Icon) or audio (1/2 beat) cue
     * with given threshold. 
     * @param cue (optional) = options for user to choose type of cue (visually or auditory). The default is none.
     * @param threshold (optional) = user have option to select their desired threshold. The default is 200.
     */

    //% group="EMG"
    //% weight=44
    //% block="measure reaction time ||add cue $cue add threshold $threshold"
    //% expandableArgumentMode="enable"
    //% threshold.defl=200
    //% inlineInputMode=inline
    export function reactionTime(cue?: Cue, threshold?: number) {
        const cue_time = 100; // [ms]
        const ms = 1500; // Give user 1.5 seconds to make reaction
        let signal = 0;
        let result = ms;
        let once = true;

        //At beggining, give user a cue if needed
        switch (cue) {
            case Cue.none: {
                break;
            }
            case Cue.visual: {
                basic.showIcon(IconNames.Heart, cue_time);
                basic.clearScreen();
                break;
            }
            case Cue.audio: {
                pins.setAudioPin(AnalogPin.P16);
                music.play(music.tonePlayable(262, cue_time),
                    music.PlaybackMode.UntilDone)
                break;
            }
        }

        const startTime = control.millis();

        // Begin measuring the reaction time
        while (control.millis() - startTime < ms) {
            signal = emg();
            // (only once) if the signal go above the threshold,
            // save the reaction time. 
            if (signal > threshold && once) {
                result = control.millis() - startTime;
                once = false;
            }
        }

        // If user fails to react, return as undefined (question mark)
        if (result == ms) {
            return undefined;
        }
        else {
            return result;
        }
    }


    /**
     * Return the average heart beat (bpm) in 5 seconds(default).
     * You can also change the time for recording from 
     * optional argument.
     * @param ms (optional) = duration(ms) to run the hearbeat recording. The default is 5000 (i.e. 5 seconds).
     */

    //% group="ECG"
    //% weight=43
    //% block="measure heartbeat (bpm) || for $ms ms"
    //% ms.shadow=timePicker
    //% expandableArgumentMode="enable"
    //% ms.defl=5000
    export function heartBeat(ms: number) {
        const down_sample_fs = 150 //Hz;
        const period = 1000000 / down_sample_fs;
        let elapsed_time = 0

        const range = 300;
        const buffer_size = 6;
        let buffer: number[] = [];
        // let buffer_index = 0;
        let beat_num = 0;
        let unit = 0;
        let sum_unit = 0;
        let wait = 0;
        let last_beat = 0;


        // Fill the buffer first
        for (let i = 0; i < buffer_size; i++) {
            buffer.push(ecg());
        }

        const startTime = control.millis();
        let prev_beat = control.millis();
        let sample_time = input.runningTimeMicros();

        // Keep running until time runs out
        while (control.millis() - startTime < ms) {
            if (wait <= 0) {

                // Buffer minimum, maximum calculation
                let buffer_min = buffer[0];
                let buffer_max = buffer[0];

                for (let i = 1; i < buffer_size; i++) {
                    if (buffer_min > buffer[i]) {
                        buffer_min = buffer[i];
                    }

                    if (buffer_max < buffer[i]) {
                        buffer_max = buffer[i];
                    }
                }

                // If the range of buffer is greator than certain range,
                // do heartbeat caluculation
                if (buffer_max - buffer_min > range) {
                    basic.showIcon(IconNames.Heart, 150);
                    basic.clearScreen();
                    last_beat = control.millis() - prev_beat;
                    prev_beat = control.millis();
                    let largeBox = Math.floor(last_beat / 200);
                    let smallBox = Math.floor((last_beat - largeBox * 200) / 40);
                    unit = 1 * largeBox + 0.2 * smallBox;
                    sum_unit += unit;
                    beat_num++;
                    // Wait for buffer_size * 3. 
                    // This is possible because distance between
                    // human heart beat is no smaller than time for
                    // buffer_size * 3 samples
                    wait = buffer_size * 3;
                }
            }


            // May need to use shift
            buffer.shift();
            buffer.push(ecg());
            // buffer[buffer_index] = val;
            // buffer_index = (buffer_index + 1) % buffer_size;
            wait--;

            // Sampling Rate caluculation
            elapsed_time = input.runningTimeMicros() - sample_time;

            if (elapsed_time < period) {
                control.waitMicros(period - elapsed_time)
            }

            sample_time = input.runningTimeMicros()
        }

        // Check to avoid division by zero
        return beat_num > 0 ? 300 / (sum_unit / beat_num) : undefined;
    }


    let currently_up = false;
    let currently_down = false;
    let center_UD = false;
    let cooldown_counter = 0;
    let blink_buffer: number[] = [];
    let updown_buffer: number[] = [];

    /**
     * Return enums (up/down/blink) if user move their eyes in
     * vertical direction.
     */

    //% group="EOG"
    //% weight=42
    //% block="direction (VEOG)"
    export function gazeV(): number {
        const time = 500; // [ms]

        const down_sample_fs = 50; // [Hz]
        const period = 1000000 / down_sample_fs; // [μs/hz]
        let elapsed_time = 0;

        let result = LookingAt.none;

        const baseline = 450;

        const buffer_size = 10;
        const wait_size = Math.floor(down_sample_fs / 3); // 1/3 of second
        let avgBuffer = 0;

        let slope = 0;
        const cooldown_period = wait_size + buffer_size;

        // Function to return the averge slope of buffer
        function calculateSlope(data: number[]): number {
            const n = data.length;
            let xSum = 0;
            let ySum = 0;
            let xySum = 0;
            let xSquaredSum = 0;

            for (let x = 0; x < n; x++) {
                xSum += x;
                ySum += data[x];
                xySum += x * data[x];
                xSquaredSum += x * x;
            }

            return (n * xySum - xSum * ySum) / (n * xSquaredSum - xSum * xSum);
        }

        const start_time = control.millis();
        let sample_time = input.runningTimeMicros();

        // Keep running until time runs out
        while (control.millis() - start_time < time) {
            let signal = eog();

            // Shift the buffer so blink analysis happens eariler than
            // up or down analysis
            if (blink_buffer.length < wait_size) {
                blink_buffer.push(signal);
            } else {
                if (updown_buffer.length < buffer_size) {
                    updown_buffer.push(blink_buffer.shift());
                } else {
                    updown_buffer.shift();
                    updown_buffer.push(blink_buffer.shift());
                }

                blink_buffer.push(signal);
            }

            if (updown_buffer.length == buffer_size) {
                slope = calculateSlope(blink_buffer.slice(0, buffer_size));
                avgBuffer = updown_buffer.reduce((a, b) => a + b, 0) / buffer_size;

                // Blinking
                if (slope < -75) {
                    // Begin cool down
                    cooldown_counter = 0;
                    result = LookingAt.blink;
                }

                // If cooldown is happening
                if (cooldown_counter >= cooldown_period) {
                    // Looking Up
                    if (avgBuffer > baseline * 1.40) {
                        if (currently_down) {
                            center_UD = true;
                        } else {
                            result = LookingAt.up;
                            center_UD = false;
                            currently_up = true;
                        }
                        // Looking Down 
                    } else if (avgBuffer < baseline * 0.60) {
                        if (currently_up) {
                            center_UD = true;
                        } else {
                            result = LookingAt.down;
                            center_UD = false;
                            currently_down = true;
                        }
                    } else {
                        if (center_UD) {
                            currently_up = false;
                            currently_down = false;
                        }
                    }
                } else {
                    cooldown_counter++;
                }
            }

            // Sampling Rate caluculation
            elapsed_time = input.runningTimeMicros() - sample_time;

            if (elapsed_time < period) {
                control.waitMicros(period - elapsed_time);
            }

            sample_time = input.runningTimeMicros();
        }

        return result;

    }


    let currently_left = false;
    let currently_right = false;
    let center_LR = false;
    let leftright_buffer: number[] = [];

    /**
     * Return enums (left/right) if user move their eyes in
     * horizontal direction.
     */

    //% group="EOG"
    //% weight=41
    //% block="direction (HEOG)"
    export function gazeH(): number {
        const time = 500; // [ms]

        const down_sample_fs = 50 // [Hz]
        const period = 1000000 / down_sample_fs // [μs/hz]
        let elapsed_time = 0;

        let result = LookingAt.none;

        const baseline = 450;

        const buffer_size = 10;
        let avgBuffer = 0;

        const start_time = control.millis();
        let sample_time = input.runningTimeMicros();

        // Keep running until time runs out
        while (control.millis() - start_time < time) {
            let signal = eog();

            // If the buffer is not full yet, keep adding
            if (leftright_buffer.length < buffer_size) {
                leftright_buffer.push(signal);
            }

            // If the buffer is full, begin main process
            if (leftright_buffer.length == buffer_size) {
                leftright_buffer.shift();
                leftright_buffer.push(signal);

                // Calculate average of buffer
                avgBuffer = leftright_buffer.reduce((a, b) => a + b, 0) / buffer_size;

                // Looking Left
                if (avgBuffer > baseline * 1.25) {
                    if (currently_right) {
                        center_LR = true;
                    }
                    else {
                        center_LR = false;
                        currently_left = true;
                        result = LookingAt.left;
                    }
                }
                // Looking Right
                else if (avgBuffer < baseline * 0.75) {
                    if (currently_left) {
                        center_LR = true;
                    }
                    else {
                        center_LR = false;
                        currently_right = true;
                        result = LookingAt.right;
                    }
                }
                else {
                    if (center_LR) {
                        currently_left = false;
                        currently_right = false;
                    }
                }
            }

            // Sampling Rate caluculation
            elapsed_time = input.runningTimeMicros() - sample_time;

            if (elapsed_time < period) {
                control.waitMicros(period - elapsed_time);
            }

            sample_time = input.runningTimeMicros();
        }

        return result;

    }


    /**
     * Return true if user blinks within some time, false otherwise.
     * Defining time is optional argument (the default is one second). 
     * @param ms (optional) = duration(ms) to check blink. The default is 1000 (i.e 1 seconds).
     */

    //% group="EOG"
    //% weight=40
    //% block="blinked|| within $ms ms"
    //% ms.shadow=timePicker
    //% expandableArgumentMode="enable"
    //% ms.defl=1000
    export function blinks(ms?: number): boolean {
        const down_sample_fs = 50 //[Hz]
        const period = 1000000 / down_sample_fs //[μs/hz]
        let elapsed_time = 0;

        const buffer_size = 2;
        let buffer = [];

        const threshold = 40;
        const blink_time = 300; //[ms]

        let blink_check_timer = 0;
        let start_val = 0;
        let currently_checking = false;

        let exit = false;

        const start_time = control.millis();
        let sample_time = input.runningTimeMicros();

        // Keep calculating until 
        // 1). time runs out
        // 2). user blinked
        while (control.millis() - start_time < ms && !exit) {
            let signal = eog();

            // If the buffer is not full yet, keep adding
            if (buffer.length < buffer_size) {
                buffer.push(signal);
            }

            // If the buffer is full, begin main process
            if (buffer.length == buffer_size) {
                buffer.shift();
                buffer.push(signal);

                // Do the following only when first point and second point 
                // differs by more than threshold
                if (Math.abs(buffer[0] - buffer[1]) > threshold) {
                    if (!currently_checking && buffer[1] > buffer[0]) {
                        blink_check_timer = control.millis();
                        start_val = buffer[0];
                        currently_checking = true;
                    }

                    if (control.millis() - blink_check_timer < blink_time) {
                        if (buffer[0] < start_val) {
                            currently_checking = false;
                            exit = true;
                        }
                    }
                    else {
                        currently_checking = false;
                    }
                }
            }

            // Sampling Rate caluculation
            elapsed_time = input.runningTimeMicros() - sample_time;

            if (elapsed_time < period) {
                control.waitMicros(period - elapsed_time);
            }

            sample_time = input.runningTimeMicros();
        }

        return exit;

    }


    /**
     * Looking Up (use with VEOG direction)
     */

    //% group="EOG"
    //% weight=39
    //% block="up"
    export function up(): number {
        return LookingAt.up;
    }


    /**
     * Looking Down (use with VEOG direction)
     */

    //% group="EOG"
    //% weight=38
    //% block="down"
    export function down(): number {
        return LookingAt.down;
    }


    /**
     * Looking Left (use with HEOG direction)
     */

    //% group="EOG"
    //% weight=37
    //% block="left"
    export function left(): number {
        return LookingAt.left;
    }


    /**
     * Looking Right (use with HEOG direction)
     */

    //% group="EOG"
    //% weight=36
    //% block="right"
    export function right(): number {
        return LookingAt.right;
    }


    /**
     * Blink (use with VEOG direction)
    */

    //% group="EOG"
    //% weight=35
    //% block="blink"
    export function blink(): number {
        return LookingAt.blink;
    }


    /**
     * Choose the signal to print in Serial. 
     * You can also specify the specific time to run the printing. 
     * The default loops.
     * @param signal = choose electrophysiology
     * @param duration (optional) = duration(ms) to output the signal. If user does not provide one, then loops
     */

    //% group="Other"
    //% weight=30
    //% block="print $signal || for $duration ms"
    //% duration.shadow=timePicker
    //% expandableArgumentMode="enable"
    //% duration.defl=0
    export function print(signal: Signal, duration?: number) {
        let startTime = 0;

        // Default: show serial output forever
        if (duration == 0) {
            while (true) {
                switch (signal) {
                    case Signal.EEG: {
                        serial.writeValue("EEG", eeg());
                        break;
                    }
                    case Signal.EMG: {
                        serial.writeValue("EMG", emg());
                        break;
                    }
                    case Signal.ECG: {
                        serial.writeValue("ECG", ecg());
                        break;
                    }
                    case Signal.EOG: {
                        serial.writeValue("EOG", eog());
                        break;
                    }
                }
            }
        }
        // Optional: show serial output as long as duration
        else {
            startTime = control.millis();
            while (control.millis() - startTime < duration) {
                switch (signal) {
                    case Signal.EEG: {
                        serial.writeValue("EEG", eeg());
                        break;
                    }
                    case Signal.EMG: {
                        serial.writeValue("EMG", emg());
                        break;
                    }
                    case Signal.ECG: {
                        serial.writeValue("ECG", ecg());
                        break;
                    }
                    case Signal.EOG: {
                        serial.writeValue("EOG", eog());
                        break;
                    }
                }
            }
        }
    }


    /**
     * Set the angle for servo.
     * @param angle = the angle for servo (in degree)
     */

    //% group="Other"
    //% weight=29
    //% block="set servo to $angle degrees"
    export function servo_control(angle: number) {
        pins.servoWritePin(AnalogPin.P8, angle);
    }


    /**
     * Pause the program from running until user defined time(ms) pass.
     * If the user provided second argument, pause the program for
     * randomized time between the first input to second input 
     *(both inclusinve).
     * @param start = time to pause program. 
     * @param end (optional) = use start and end to as range to pick the random time. The default is 0.
     */

    //% group="Other"
    //% weight=28
    //% block="Wait for $start (ms) || $end (ms)"
    //% start.shadow=timePicker
    //% end.shadow=timePicker
    //% wait.defl=0;
    export function wait(start: number, end?: number) {
        let waiting_time = 0;

        // If user provides the second argument, choose random time,
        // to wait, else set the the first argument.
        if (end > 0 && end > start) {
            waiting_time = randint(start, end);
        }
        else {
            waiting_time = start;
        }

        // Run while loop for some duration
        const start_time = control.millis();
        while (control.millis() - start_time < waiting_time) {
            continue;
        }
    }

}
