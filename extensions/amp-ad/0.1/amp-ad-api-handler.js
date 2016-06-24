/**
 * Copyright 2016 The AMP HTML Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {getIframe} from '../../../src/3p-frame';
import {removeElement} from '../../../src/dom';
import {loadPromise} from '../../../src/event-helper';
import {listenFor, listenForOnce, postMessage}
    from '../../../src/iframe-helper';
import {parseUrl} from '../../../src/url';

export class AmpAdApiHandler {
  constructor(win, element, adImpl) {
    this.adImpl_ = adImpl;
    this.element_ = element;
    this.iframe_ = null;
    this.fallback_ = this.adImpl_.getFallback();
    this.placeholder_ = this.adImpl_.getPlaceholder();
    this.embedSizeUnlistener_ = null;
  }

  startUp() {
    this.iframe_ = getIframe(win, this.element_);
    this.iframe_.setAttribute('scrolling', 'no');
    this.adImpl_.applyFillContent(this.iframe_);
    this.adImpl_.setUpIntersectionObserver(this.iframe_);
    // Triggered by context.noContentAvailable() inside the ad iframe.
    listenForOnce(this.iframe_, 'no-content', () => {
      this.noContentHandler_();
    }, /* opt_is3P */ true);
    // Triggered by context.reportRenderedEntityIdentifier(…) inside the ad
    // iframe.
    listenForOnce(this.iframe_, 'entity-id', info => {
      this.element_.creativeId = info.id;
    }, /* opt_is3P */ true);
    this.embedSizeUnlistener_ = listenFor(this.iframe_, 'embed-size', data => {
      let newHeight, newWidth;
      if (data.width !== undefined) {
        newWidth = Math.max(this.element_./*OK*/offsetWidth +
            data.width - this.iframe_./*OK*/offsetWidth, data.width);
        this.iframe_.width = data.width;
        this.element_.setAttribute('width', newWidth);
      }
      if (data.height !== undefined) {
        newHeight = Math.max(this.element_./*OK*/offsetHeight +
            data.height - this.iframe_./*OK*/offsetHeight, data.height);
        this.iframe_.height = data.height;
        this.element_.setAttribute('height', newHeight);
      }
      if (newHeight !== undefined || newWidth !== undefined) {
        this.updateSize_(newHeight, newWidth);
      }
    }, /* opt_is3P */ true);
    this.iframe_.style.visibility = 'hidden';
    listenForOnce(this.iframe_, 'render-start', () => {
      this.iframe_.style.visibility = '';
      this.sendEmbedInfo_(this.adImpl_.isInViewport());
    }, /* opt_is3P */ true);
    this.adImpl_.getViewer().onVisibilityChanged(() => {
      this.sendEmbedInfo_(this.adImpl_.isInViewport());
    });
    this.element_.appendChild(this.iframe_);
    return loadPromise(this.iframe_);
  }

  shutDown() {
    if (this.embedSizeUnlistener_) {
      this.embedSizeUnlistener_();
    }
    if (this.iframe_) {
      removeElement(this.iframe_);
    }
  }

  getIframe() {
    return this.iframe_;
  }

  getSrc() {
    return this.iframe_ ? this.iframe_.src : null;
  }

  /**
   * Activates the fallback if the ad reports that the ad slot cannot
   * be filled.
   * @private
   */
  noContentHandler_() {
    // If a fallback does not exist, attempt to collapse the ad.
    if (!this.fallback_) {
      this.adImpl_.attemptChangeHeight(0, () => {
        this.element.style.display = 'none';
      });
    }
    this.deferMutate(() => {
      this.adImpl_.attemptToggleFallback(true);
      // Remove the iframe only if it is not the master.
      if (this.iframe_.name.indexOf('_master') == -1) {
        removeElement(this.iframe_);
        this.iframe_ = null;
      }
    });
  }

  /**
   * Updates the element's dimensions to accommodate the iframe's
   *    requested dimensions.
   * @param {number|undefined} newWidth
   * @param {number|undefined} newHeight
   * @private
   */
  updateSize_(newHeight, newWidth) {
    this.element_.attemptChangeSize(newHeight, newWidth, () => {
      const targetOrigin =
          this.iframe_.src ? parseUrl(this.iframe_.src).origin : '*';
      postMessage(
          this.iframe_,
          'embed-size-changed',
          {requestedHeight: newHeight, requestedWidth: newWidth},
          targetOrigin,
          /* opt_is3P */ true);
    });
  }

  /**
   * @param {boolean} inViewport
   * @private
   */
  sendEmbedInfo_(inViewport) {
    if (this.iframe_) {
      const targetOrigin =
          this.iframe_.src ? parseUrl(this.iframe_.src).origin : '*';
      postMessage(this.iframe_, 'embed-state', {
        inViewport,
        pageHidden: !this.adImpl_.getViewer().isVisible(),
      }, targetOrigin, /* opt_is3P */ true);
    }
  }

  /** @override  */
  viewportCallback(inViewport) {
    if (this.adImpl_.getIntersectionObserver()) {
      this.adImpl_.getIntersectionObserver().onViewportCallback(inViewport);
    }
    this.sendEmbedInfo_(inViewport);
  }

}