'use strict';

// Imported Node modules
const Path = require('path');
const Fs = require('fs');
// Imported Other modules
const $ = require('jquery');
const Plugin = require('./plugin');

// The plugins folder
var plugPath = Path.join(__dirname, '..', 'plugins');
// Object to hold plugins and other public members
var plugins = {};

/**
 * Detects the home Plugin or otherwise the alphabetically first
 * plugin and sets its button and view to be first in order
 * @function PluginManager~setOrder
 * @todo: this is hardcoded, perhaps can add priority system
 * @param {string[]} pluginNames - array of subdirectories of plugins/
 */
function setOrder(pluginNames) {
	// Detect if about plugin is installed
	var aboutIndex = pluginNames.indexOf('About');
	if (aboutIndex !== -1) {
		// Swap it to be last
		pluginNames[aboutIndex] = pluginNames[pluginNames.length - 1];
		pluginNames[pluginNames.length - 1] = 'About';
	}

	// Detect if home plugin is installed
	var homeIndex = pluginNames.indexOf(plugins.Home);
	if (homeIndex !== -1) {
		// Swap it to be first
		pluginNames[homeIndex] = pluginNames[0];
		pluginNames[0] = plugins.Home;
		return;
	}
	// No home plugin installed
	plugins.Home = pluginNames[0];
}

/**
 * Handles listening for plugin messages and reacting to them
 * @function PluginManager~addListeners
 * @param {Plugin} plugin - a newly made plugin object
 */
function addListeners(plugin) {
	/** 
	 * Standard transition upon button click.
	 * @typedef transition
	 */
	plugin.transition(function() {
		// Don't do anything if already on this plugin
		if (plugins.Current === plugin || plugins.Current.isLoading()) {
			return;
		}

		// Fadein and fadeout mainbar
		var main = document.getElementById('mainbar').classList;
		main.add('transition');
		setTimeout(function() {
			main.remove('transition');
		}, 170);

		// Switch plugins
		plugins.Current.hide();
		plugins.Current = plugin;
		plugins.Current.show();
	});
	
	// Handle any ipc messages from the plugin
	plugin.on('ipc-message', function(event) {
		var responseChannel;
		switch(event.channel) {
			case 'notification':
				// Use UI notification system
				UI.notify.apply(null, event.args);
				break;
			case 'tooltip':
				// Use UI tooltip system
				event.args[1].top += $('.header').height();
				event.args[1].left += $('#sidebar').width();
				UI.tooltip.apply(null, event.args);
				break;
			case 'devtools':
				// Plugin called for its own devtools, toggle it
				plugin.toggleDevTools();
				break;
			default:
				UI.notify('Unknown ipc message: ' + event.channel, 'error');
		}
	});

	// Display any console messages from the plugin
	plugin.on('console-message', function(event) {
		var srcFile = event.sourceId.replace(/^.*[\\\/]/, '');
		console.log(plugin.name + ' plugin logged from ' + srcFile +'(' + event.line + '): ' + event.message);
	});
}

/**
 * Constructs the plugins and adds them to this manager 
 * @function PluginManager~addPlugin
 * @param {string} name - The plugin folder's name
 */
function addPlugin(name) {
	// Make the plugin, giving its button a standard transition
	var plugin = new Plugin(plugPath, name);

	// Start with the home plugin as current
	if (name === plugins.Home) {
		plugins.Home = plugin;
		plugins.Current = plugin;
		plugin.on('dom-ready', plugins.Current.show);
	}

	// addListeners deals with any webview related async tasks
	addListeners(plugin);

	// Store the plugin
	plugins[name] = plugin;
}

/**
 * Reads the config's plugPath for plugin folders
 * @function PluginManager~initPlugins
 */
function initPlugins() {
	Fs.readdir(plugPath, function(err, pluginNames) {
		if (err) {
			UI.notify('Couldn\'t read plugins folder: ' + err, 'error');
		}

		// Determine default plugin
		setOrder(pluginNames);
		
		// Initialize each plugin according to config
		pluginNames.forEach(addPlugin);
	});
}

plugins.Home = require('electron').ipcRenderer.sendSync('config', 'homePlugin');
initPlugins();

// Return plugins
module.exports = plugins;
