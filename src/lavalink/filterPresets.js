'use strict';

/**
 * Audio Filter Presets for Lavalink
 */
const PRESETS = {
    bassboost: {
        equalizer: [
            { band: 0, gain: 0.25 },
            { band: 1, gain: 0.25 },
            { band: 2, gain: 0.25 },
            { band: 3, gain: 0.15 },
            { band: 4, gain: 0.10 },
            { band: 5, gain: 0.05 },
        ]
    },
    nightcore: {
        timescale: {
            speed: 1.25,
            pitch: 1.25,
            rate: 1.0
        }
    },
    vaporwave: {
        timescale: {
            speed: 0.85,
            pitch: 0.80,
            rate: 1.0
        }
    },
    '8d': {
        rotation: {
            rotationHz: 0.2
        }
    }
};

/**
 * Toggles a filter on a player.
 * @param {import('lavalink-client').Player} player 
 * @param {string} filterName 
 */
async function toggleFilter(player, filterName) {
    if (!player) return;
    
    // Get currently active filters from player metadata
    let activeFilters = player.get('activeFilters') || {};
    
    if (activeFilters[filterName]) {
        // Toggle OFF: Reset this specific filter
        delete activeFilters[filterName];
        
        if (filterName === 'bassboost') {
            await player.filterManager.setEqualizer([]);
        } else if (filterName === 'nightcore' || filterName === 'vaporwave') {
            await player.filterManager.setTimescale(null);
        } else if (filterName === '8d') {
            await player.filterManager.setRotation(null);
        }
    } else {
        // Toggle ON: Apply the preset
        const preset = PRESETS[filterName];
        if (!preset) return;

        // Mutually exclusive filters (Nightcore vs Vaporwave)
        if (filterName === 'nightcore' && activeFilters['vaporwave']) delete activeFilters['vaporwave'];
        if (filterName === 'vaporwave' && activeFilters['nightcore']) delete activeFilters['nightcore'];

        activeFilters[filterName] = true;

        if (preset.equalizer) await player.filterManager.setEqualizer(preset.equalizer);
        if (preset.timescale) await player.filterManager.setTimescale(preset.timescale);
        if (preset.rotation) await player.filterManager.setRotation(preset.rotation);
    }

    // Save state in player metadata
    player.set('activeFilters', activeFilters);
}

module.exports = { PRESETS, toggleFilter };
