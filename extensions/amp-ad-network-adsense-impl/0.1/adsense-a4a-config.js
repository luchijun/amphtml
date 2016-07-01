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

import {getMode} from '../../../src/mode';
import {
  setupPageExperiments,
  getPageExperimentBranch,
  forceExperimentBranch,
  addExperimentIdToElement,
} from '../../../ads/google/traffic-experiments';
import {isExperimentOn} from '../../../src/experiments';
import {isProxyOrigin} from '../../../src/url';
import {dev} from '../../../src/log';

/** @const {!string} @private */
export const GOOGLE_A4A_EXPT_ID_ = 'expA4A';

/** @const {!ExperimentInfo} @private */
export const a4aExperimentInfo = {
  // Google experiment to test the 3p iframe ad (i.e., the original amp-ad
  // implementation) against new, A4A tag implementation.
  'expA4A': {
    control: '117152630',
    experiment: '117152631',
  },
};

/**
 * Check whether Adsense supports the A4A rendering pathway for a given ad
 * Element on a given Window.  The tests we use are:
 * <ol>
 *   <li>The page must have originated in the {@code cdn.ampproject.org}
 *   CDN <em>or</em> we must be running in local dev mode.</li>
 *   <li>We must be selected in to an A4A traffic experiment and be selected
 *   into the "experiment" branch.
 * </ol>
 *
 * If we're selected into the overall traffic experiment, this function will
 * also attach an experiment or control branch ID to the {@code Element} as
 * a side-effect.
 *
 * @param {!Window} win  Host window for the ad.
 * @param {!Element} element Ad tag Element.
 * @returns {boolean}  Whether adsense should attempt to render via the A4A
 *   pathway.
 */
export function adsenseIsA4AEnabled(win, element) {
  // Note: Theoretically, isProxyOrigin is the right way to do this, b/c it
  // will be kept up to date with known proxies.  However, it doesn't seem to
  // be compatible with loading the example files from localhost.  To hack
  // around that, just say that we're A4A eligible if we're in local dev
  // mode, regardless of origin path.
  if (isAdsenseA4AValidEnvironment(win)) {
    // Page is served from a supported domain.
    handleUrlParameters(win);
    setupPageExperiments(win, a4aExperimentInfo);
    if (isExperimentOn(win, GOOGLE_A4A_EXPT_ID_)) {
      // Page is selected into the overall traffic experiment.
      const branches = a4aExperimentInfo[GOOGLE_A4A_EXPT_ID_];
      if (getPageExperimentBranch(win, GOOGLE_A4A_EXPT_ID_) ===
          branches.experiment) {
        // Page is on the "experiment" (i.e., use A4A rendering pathway)
        // branch of the overall traffic experiment.
        addExperimentIdToElement(branches.experiment, element);
        return true;
      } else {
        // Page is on the "control" (i.e., use traditional, 3p iframe
        // rendering pathway) branch of the overall traffic experiment.
        addExperimentIdToElement(branches.control, element);
        return false;
      }
    }
  }
  // Serving location doesn't qualify for A4A treatment or page is not in the
  // traffic experiment.
  return false;
}

/**
 * Set experiment state from URL parameter, if present.
 *
 * @param {!Window} win
 * @visibleForTesting
 */
export function handleUrlParameters(win) {
  const a4aParam = /(?:\?|&)a4a=([0-9]+)/.exec(win.location.search);
  if (a4aParam && a4aParam.length > 1) {
    switch (a4aParam[1]) {
      case '0':
        // Not selected into experiment.  Disable the experiment altogether, so
        // that setupPageExperiments doesn't accidentally enable it.
        forceExperimentBranch(win, GOOGLE_A4A_EXPT_ID_, false);
        break;
      case '1':
        // Selected in; on control branch.
        forceExperimentBranch(win, GOOGLE_A4A_EXPT_ID_,
            a4aExperimentInfo[GOOGLE_A4A_EXPT_ID_].control);
        break;
      case '2':
        // Selected in; on experiment branch.
        forceExperimentBranch(win, GOOGLE_A4A_EXPT_ID_,
            a4aExperimentInfo[GOOGLE_A4A_EXPT_ID_].experiment);
        break;
      default:
        dev.warn('adsense-a4a-config', 'Unknown a4a URL parameter: ',
                 a4aParam[1]);
    }
  }
}

/**
 * Check whether Adsense supports the A4A rendering pathway is valid for the
 * environment by ensuring native crypto support and page originated in the
 * the {@code cdn.ampproject.org} CDN <em>or</em> we must be running in local
 * dev mode.
 *
 * @param {!Window} win  Host window for the ad.
 * @returns {boolean}  Whether adsense should attempt to render via the A4A
 *   pathway.
 */
export function isAdsenseA4AValidEnvironment(win) {
  const supportsNativeCrypto = win.crypto &&
      (win.crypto.subtle || win.crypto.webkitSubtle);
  // Note: Theoretically, isProxyOrigin is the right way to do this, b/c it
  // will be kept up to date with known proxies.  However, it doesn't seem to
  // be compatible with loading the example files from localhost.  To hack
  // around that, just say that we're A4A eligible if we're in local dev
  // mode, regardless of origin path.
  return supportsNativeCrypto &&
      (isProxyOrigin(win.location) || getMode().localDev);
}
