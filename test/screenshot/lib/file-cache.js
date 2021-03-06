/*
 * Copyright 2018 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const fs = require('mz/fs');
const mkdirp = require('mkdirp');
const os = require('os');
const path = require('path');
const request = require('request-promise-native');

const mdcProto = require('../proto/mdc.pb').mdc.proto;
const {TestFile} = mdcProto;

/**
 * Downloads binary files from public URLs and saves them to a stable path in the TEMP directory for later retrieval.
 */
class FileCache {
  constructor() {
    /**
     * @type {string}
     * @private
     */
    this.tempDirPath_ = path.join(os.tmpdir(), 'mdc-web/url-cache');
  }

  /**
   * @param {string} uri Public URI or local file path.
   * @param {?string=} encoding 'utf8' for text, or `null` for binary data.
   * @return {!Promise<!mdc.proto.TestFile>} Local copy of the file pointed to by `uri`.
   */
  async downloadUrlToDisk(uri, encoding = null) {
    mkdirp.sync(this.tempDirPath_);

    const fakeRelativePath = uri.replace(/.*\/mdc-/, 'mdc-'); // TODO(acdvorak): Document this hack

    if (await fs.exists(uri)) {
      return TestFile.create({
        absolute_path: path.resolve(uri),
        relative_path: fakeRelativePath,
        public_url: path.resolve(uri),
      });
    }

    const fileName = this.getFilename_(uri);
    const filePath = path.resolve(this.tempDirPath_, fileName);
    if (await fs.exists(filePath)) {
      return TestFile.create({
        absolute_path: filePath,
        relative_path: fakeRelativePath,
        public_url: uri,
      });
    }

    const buffer = await request({uri, encoding});
    await fs.writeFile(filePath, buffer, {encoding})
      .catch(async (err) => {
        console.error(`downloadUrlToDisk("${uri}"):`);
        console.error(err);
        if (await fs.exists(filePath)) {
          await fs.unlink(filePath);
        }
      });

    return TestFile.create({
      absolute_path: filePath,
      relative_path: fakeRelativePath,
      public_url: uri,
    });
  }

  /**
   * @param {string} uri
   * @return {string}
   * @private
   */
  getFilename_(uri) {
    return uri
      .replace(/[^a-zA-Z0-9_.-]+/g, '_')
      .replace(/_{2,}/g, '_')
    ;
  }
}

module.exports = FileCache;
