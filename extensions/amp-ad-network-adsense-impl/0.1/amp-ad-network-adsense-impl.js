/* Copyright 2016 The AMP HTML Authors. All Rights Reserved.
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

import {AmpA4A} from '../../amp-a4a/0.1/amp-a4a';
import {isAdsenseA4AValidEnvironment} from './adsense-a4a-config';
import {getMode} from '../../../src/mode';
import {getAdCid} from '../../../src/ad-cid';
import {
  getAdsenseInfo,
  adsenseRequestUrl,
  getAmpCorrelator,
} from '../../../ads/google/a4a-utils';
import {documentInfoFor} from '../../../src/document-info';
import {timer} from '../../../src/timer';

const AMP_SIGNATURE_HEADER = 'X-AmpAdSignature';

/**
 * Make the URL for an ad request, from an amp-ad element.
 * @param {number} startTime
 * @param {number} slotNumber
 * @param {!Window} global
 * @param {!Object} data
 * @param {number} isAmp
 * @param {?string} clientId
 * @param {!IntersectionObserverEntry} intersectionRecord
 * @return {string}
 */
function adsenseRequestUrlForAmpA4a_(startTime, slotNumber, global, data,
    isAmp, clientId,
    intersectionRecord) {
  const documentInfo = documentInfoFor(global);
  const pageViewId = documentInfo.pageViewId;
  return adsenseRequestUrl(startTime, slotNumber, global, data, isAmp,
      documentInfo.canonicalUrl,
      getAmpCorrelator(clientId, pageViewId),
      intersectionRecord);
}

export class AmpAdNetworkAdSenseImpl extends AmpA4A {
   constructor(element) {
     super(element);
   }

   /** @override */
   isValidElement() {
     return this.isValidImplementation_() &&
       !!this.element.parentElement &&
       this.element.parentElement.tagName == 'AMP-AD' &&
       !!this.element.getAttribute('data-ad-client');
   }

   /**
    * @returns {boolean} Whether environment is suitable for A4A.
    * @private
    */
   isValidImplementation_() {
     return isAdsenseA4AValidEnvironment(this.getWin());
   }

   /** @override */
   getAdUrl() {
     const startTime = timer.now();
     const adsenseInfo = getAdsenseInfo(this.getWin());
     // Get slot number asap.
     const slotNumber = adsenseInfo.nextSlotNumber();

     return getAdCid(this).then(clientId => {
       const global = this.getWin();
       const documentInfo = documentInfoFor(global);
       if (!global.gaGlobal) {
         // Read by GPT for GA/GPT integration.
         global.gaGlobal = {
           vid: clientId,
           hid: documentInfo.pageViewId,
         };
       }

       const isAmp = this.supportsShadowDom() ? 3 : 2;
       const change = this.element.getIntersectionChangeEntry();
       // Allow us to force certain creative types for testing.
       let ctypes = null;
       if (getMode().localDev) {
         const ctypesReMatch = (/(?:\?|&)force_a4a_ctypes=([^&]+)/.exec(
             this.getWin().location.search));
         if (ctypesReMatch && ctypesReMatch.length > 1) {
           ctypes = ctypesReMatch[1];
         }
       }
       // Treat this.getWin() as "master".
       return adsenseRequestUrlForAmpA4a_(
         startTime, slotNumber, global,
         {adClient: this.element.getAttribute('data-ad-client'),
          adSlot: this.element.getAttribute('data-ad-slot'),
          adHost: this.element.getAttribute('data-ad-host'),
          adtest: this.element.getAttribute('data-adtest'),
          experimentId: this.element.getAttribute('data-experiment-id'),
          tagOrigin: this.element.getAttribute('data-tag-origin'),
          ctypes},
         isAmp,
         clientId, change);
     });
   }

   /** @override */
   extractCreativeAndSignature(responseText, responseHeaders) {
     const adResponse = {
       creativeArrayBuffer: responseText,
       signature: null,
     };
     try {
       adResponse['signature'] = responseHeaders.get(AMP_SIGNATURE_HEADER);
     } finally {
       return Promise.resolve(adResponse);
     }
   }
 }

AMP.registerElement('amp-ad-network-adsense-impl', AmpAdNetworkAdSenseImpl);
