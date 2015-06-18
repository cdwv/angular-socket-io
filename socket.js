/*
 * @license
 * angular-socket-io v0.7.2
 * (c) 2014 Brian Ford http://briantford.com
 * License: MIT
 */

angular.module('btford.socket-io', []).
  provider('socketFactory', function () {

    'use strict';

    // when forwarding events, prefix the event name
    var defaultPrefix = 'socket:',
      ioSocket;

    // expose to provider
    this.$get = ['$rootScope', '$timeout', function ($rootScope, $timeout) {

      var asyncAngularify = function (socket, callback) {
        return callback ? function () {
          var args = arguments;
          $timeout(function () {
            callback.apply(socket, args);
          }, 0);
        } : angular.noop;
      };

      return function socketFactory (options) {
        options = options || {};
        var socket = null;
        var socketOptions = options.socketOptions || {};
        var socketUri = options.uri;
        if(options.autoStart) {
          socket = options.ioSocket || io.connect(socketUri, socketOptions);
        }

        var prefix = options.prefix === undefined ? defaultPrefix : options.prefix ;
        var defaultScope = options.scope || $rootScope;

        var addListener = function (eventName, callback) {
          socket.on(eventName, callback.__ng = asyncAngularify(socket, callback));
        };

        var addOnceListener = function (eventName, callback) {
          socket.once(eventName, callback.__ng = asyncAngularify(socket, callback));
        };

        var wrappedSocket = {
          on: addListener,
          addListener: addListener,
          once: addOnceListener,

          emit: function (eventName, data, callback) {
            var lastIndex = arguments.length - 1;
            var callback = arguments[lastIndex];
            if(typeof callback == 'function') {
              callback = asyncAngularify(socket, callback);
              arguments[lastIndex] = callback;
            }
            return socket.emit.apply(socket, arguments);
          },

          removeListener: function (ev, fn) {
            if (fn && fn.__ng) {
              arguments[1] = fn.__ng;
            }
            return socket.removeListener.apply(socket, arguments);
          },

          removeAllListeners: function() {
            return socket.removeAllListeners.apply(socket, arguments);
          },

          disconnect: function (close) {
            return socket.disconnect(close);
          },

          connect: function() {
            return socket.connect();
          },

          // when socket.on('someEvent', fn (data) { ... }),
          // call scope.$broadcast('someEvent', data)
          forward: function (events, scope) {
            if (events instanceof Array === false) {
              events = [events];
            }
            if (!scope) {
              scope = defaultScope;
            }
            events.forEach(function (eventName) {
              var prefixedEvent = prefix + eventName;
              var forwardBroadcast = asyncAngularify(socket, function () {
                Array.prototype.unshift.call(arguments, prefixedEvent);
                scope.$broadcast.apply(scope, arguments);
              });
              scope.$on('$destroy', function () {
                socket.removeListener(eventName, forwardBroadcast);
              });
              socket.on(eventName, forwardBroadcast);
            });
          }
        };

        var cachedEvents = [];

        // When autostart is disabled cache all triggers until ready
        var cachedSocket = {
          on: function() { if(socket) { wrappedSocket.on.apply(wrappedSocket, arguments); } else { cachedEvents.push(['on', arguments])}},
          addListener: function() { if(socket) { wrappedSocket.addListener.apply(wrappedSocket, arguments); } else { cachedEvents.push(['addListener', arguments])}},
          once: function() { if(socket) { wrappedSocket.once.apply(wrappedSocket, arguments); } else { cachedEvents.push(['once', arguments])}},
          emit: function() { if(socket) { wrappedSocket.emit.apply(wrappedSocket, arguments); } else { cachedEvents.push(['emit', arguments])}},
          removeListener: function() { if(socket) { wrappedSocket.removeListener.apply(wrappedSocket, arguments); } else { cachedEvents.push(['removeListener', arguments])}},
          removeAllListeners: function() { if(socket) { wrappedSocket.removeAllListeners.apply(wrappedSocket, arguments); } else { cachedEvents.push(['removeAllListeners', arguments])}},
          disconnect: function() { if(socket) { wrappedSocket.disconnect.apply(wrappedSocket, arguments); } else { cachedEvents.push(['disconnect', arguments])}},
          connect: function() { if(socket) { wrappedSocket.connect.apply(wrappedSocket, arguments); } else { cachedEvents.push(['connect', arguments])}},
          forward: function() { if(socket) { wrappedSocket.forward.apply(wrappedSocket, arguments); } else { cachedEvents.push(['forward', arguments])}},
          start: function() { 
            socket = io.connect(socketUri, socketOptions);
            for(var i in cachedEvents) {
              var method = cachedEvents[i].shift();
              var args = cachedEvents[i].shift();
              wrappedSocket[method].apply(wrappedSocket, args);
            }
          }
        };

        return cachedSocket;
      };
    }];
  });
