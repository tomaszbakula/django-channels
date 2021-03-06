"use strict";

import 'regenerator-runtime/runtime';
import { EventTarget, defineEventAttribute } from "event-target-shim";
import ReconnectingWebSocket from 'reconnecting-websocket';


class Forwarder extends EventTarget {
  constructor() {
    super();
    this.forwardEvent = this.forwardEvent.bind(this);
  }

  forwardEvent(event) {
    //console.log(`forwarding ${event.type}`);
    this.dispatchEvent(event);
  }
}
/**
 * Handle messages to and from a specific stream.
 *
 * @example
 * const stream = new Stream("streamName", websocket);
 * stream.send({prop1: 'value1', prop2: 'value2'})
 */
export class Stream extends Forwarder {
  /**
   *
   * @param {String} name The stream name
   * @param {ReconnectingWebSocket} socket An instance of `ReconnectingWebSocket`
   *
   * @example
   * const stream = new Stream("streamName", websocket);
   */
  constructor(name, socket) {
    super();
    this.name = name;
    this.socket = socket;
    this.handleMessage = this.handleMessage.bind(this);
    this.socket.addEventListener("message", this.handleMessage);
    this.socket.addEventListener("open", this.forwardEvent);
    this.socket.addEventListener("close", this.forwardEvent);
    this.socket.addEventListener("error", this.forwardEvent);
  }

  handleMessage(event) {
    const msg = JSON.parse(event.data);
    if (msg.stream === this.name) {
      const e = new MessageEvent(
        'message', {
          data: msg.payload,
          origin: this.name
        }
      );
      this.dispatchEvent(e);
    }
  }

  /**
   * Sends a message to the reply channel.
   *
   * @param      {Object}  action     The message
   *
   * @example
   * Stream("myStream", ws).send({prop1: 'value1', prop2: 'value2'});
   */
  send(action) {
      const msg = {
        stream: this.name,
        payload: action,
      };
      this.socket.send(JSON.stringify(msg));
  }
}
defineEventAttribute(Stream.prototype, "open");
defineEventAttribute(Stream.prototype, "close");
defineEventAttribute(Stream.prototype, "error");
defineEventAttribute(Stream.prototype, "message");

/**
 * Bridge between Channels and plain javascript.
 *
 * @example
 * const webSocketBridge = new WebSocketBridge();
 * webSocketBridge.connect("http://example.com/ws/");
 * webSocketBridge.addEventListener("message", function(event) {
 *   console.log(event.data);
 * });
 */
export class WebSocketBridge extends Forwarder {
  constructor(options) {
    super();
    this.socket = null;
    this.streams = {};
    this.options = {...options};
    this.handleMessage = this.handleMessage.bind(this);
}

  /**
   * Connect to the websocket server
   *
   * @param      {String}  [url]     The url of the websocket. Defaults to
   * `window.location.host`
   * @param      {String[]|String}  [protocols] Optional string or array of protocols.
   * @param      {Object} options Object of options for [`reconnecting-websocket`](https://github.com/joewalnes/reconnecting-websocket#options-1).
   * @example
   * const webSocketBridge = new WebSocketBridge();
   * webSocketBridge.connect("http://example.com/ws/");
   */
  connect(url, protocols, options) {
    let _url;
    // Use wss:// if running on https://
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    let base_url = `${scheme}://${window.location.host}`;
    if (url === undefined) {
      _url = base_url;
    } else {
      // Support relative URLs
      if (url[0] == '/') {
        _url = `${base_url}${url}`;
      } else {
        _url = url;
      }
    }
    this.socket = new ReconnectingWebSocket(_url, protocols, options);
    this.socket.addEventListener("open", this.forwardEvent);
    this.socket.addEventListener("close", this.forwardEvent);
    this.socket.addEventListener("error", this.forwardEvent);
    this.socket.addEventListener("message", this.handleMessage);

  }

  handleMessage(event) {
    const msg = JSON.parse(event.data);

    if (msg.stream === undefined) {
      const e = new MessageEvent(
        'message', {
          data: msg,
          origin: ''
        }
      );
      this.dispatchEvent(e);
    }
  }

  /**
   * Adds a 'stream handler' callback. Messages coming from the specified stream
   * will call the specified callback.
   * Essentianlly, this is a shortcut for `stream(streamName).addEventListener("message", callback)`;
   *
   * @param      {String}    stream  The stream name
   * @param      {Function}  cb      Callback to be execute when a message
   * arrives. The callback will receive `action` and `stream` parameters.

   * @example
   * const webSocketBridge = new WebSocketBridge();
   * webSocketBridge.connect("http://example.com/ws/");
   * webSocketBridge.demultiplex('mystream', function(action, stream) {
   *   console.log(action, stream);
   * });
   * webSocketBridge.demultiplex('myotherstream', function(action, stream) {
   *   console.info(action, stream);
   * });
   */
  demultiplex(stream, cb) {
    this.stream(stream).addEventListener("message", cb);
  }

  /**
   * Sends a message to the reply channel.
   *
   * @param      {Object}  msg     The message
   *
   * @example
   * webSocketBridge.send({prop1: 'value1', prop2: 'value2'});
   */
  send(msg) {
    this.socket.send(JSON.stringify(msg));
  }

  /**
   * Returns a Stream to send and receive messages to and from a specific streamName
   *
   * @param      {String}  streamName  The streamName name
   * @return     {Stream}  Stream object bound to stream `streamName`.
   * @example
   * webSocketBridge.stream('mystream').send({prop1: 'value1', prop2: 'value1'})
   */
  stream(streamName) {
    let stream;
    if (this.streams[streamName] !== undefined) {
      stream = this.streams[streamName];
    } else {
      stream = new Stream(streamName, this.socket);
      this.streams[streamName] = stream;
    }
    return stream;
  }
}
defineEventAttribute(WebSocketBridge.prototype, "open");
defineEventAttribute(WebSocketBridge.prototype, "close");
defineEventAttribute(WebSocketBridge.prototype, "error");
defineEventAttribute(WebSocketBridge.prototype, "message");
