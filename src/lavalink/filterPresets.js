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
    
    let activeFilters = player.get('activeFilters') || {};
    const preset = PRESETS[filterName];
    
    if (activeFilters[filterName]) {
        // Toggle OFF
        delete activeFilters[filterName];
        
        if (filterName === 'bassboost') {
            await player.filterManager.clearEQ();
        } else if (filterName === 'nightcore' || filterName === 'vaporwave') {
            player.filterManager.data.timescale = null;
            await player.filterManager.applyPlayerFilters();
        } else if (filterName === '8d') {
            player.filterManager.data.rotation = null;
            await player.filterManager.applyPlayerFilters();
        }
    } else {
        // Toggle ON
        if (!preset) return;

        // Mutual exclusivity
        if (filterName === 'nightcore' && activeFilters['vaporwave']) delete activeFilters['vaporwave'];
        if (filterName === 'vaporwave' && activeFilters['nightcore']) delete activeFilters['nightcore'];

        activeFilters[filterName] = true;

        if (preset.equalizer) {
            await player.filterManager.setEQ(preset.equalizer);
        }
        if (preset.timescale) {
            player.filterManager.data.timescale = preset.timescale;
            await player.filterManager.applyPlayerFilters();
        }
        if (preset.rotation) {
            player.filterManager.data.rotation = preset.rotation;
            await player.filterManager.applyPlayerFilters();
        }
    }

    player.set('activeFilters', activeFilters);
}

module.exports = { PRESETS, toggleFilter };
