#! /usr/bin/env node

var propertiesParser = require(`properties-parser`);
var path = require(`path`);
var FS = require(`q-io/fs`);
var Habitat = require(`habitat`);
var argv = require(`minimist`)(process.argv.slice(2));

Habitat.load();
var env = new Habitat();

var supportedLocales = env.get(`SUPPORTED_LOCALES`) || `*`;

var config = {
  "dest": argv.dest || `dist`,
  "src": argv.src || `locales`
};

function getListLocales() {
  return new Promise((resolve, reject)=> {
    if (supportedLocales === `*`) {
      FS.listDirectoryTree(path.join(process.cwd(), config.src)).then((dirTree) => {
        var localeList = [];

        dirTree.forEach((localeLocation) => {

          // Get the locale code from the end of the path. We're expecting the structure of Pontoon's output here
          var langcode = localeLocation.split(path.sep).slice(-1)[0];

          if (langcode) {
            localeList.push(langcode);
          }
        });
        return resolve(localeList);
      }).catch((e) => {
        console.log(e);
        reject(e);
      });
    } else {
      resolve(supportedLocales);
    }
  });
}

function writeFile(entries) {
  var dictionary = entries.reduce((prevEntry, entry) => {
    prevEntry[entry.locale] = entry.content;
    return prevEntry;
  }, {});
  var publicPath = path.join(process.cwd(), config.dest);
  var localesPath = path.join(publicPath, `locales.json`);

  FS.makeTree(publicPath).then(() => {
    FS.write(localesPath, JSON.stringify(dictionary, null, 2))
    .then(() => {
      console.log(`Done compiling locales at: ${localesPath}`);
    }).catch((e) => {
      console.log(e);
    });
  }).catch((e) => {
    console.log(e);
  });
}

function readPropertiesFile(filePath) {
  return new Promise((resolve, reject) => {
    propertiesParser.read(filePath, (messageError, messageProperties) => {
      if (messageError && messageError.code !== `ENOENT`) {
        return reject(messageError);
      }
      resolve(messageProperties);
    });
  });
}

function getContentMessages(locale) {
  return new Promise((resolve, reject) => {
    FS.listTree(path.join(process.cwd(), config.src, locale), (filePath) => {
      return path.extname(filePath) === `.properties`;
    }).then((files) => {
      Promise.all(files.map(readPropertiesFile)).then((properties) => {
        var mergedProperties = {};

        properties.forEach((messages) => {
          Object.assign(mergedProperties, messages);
        });

        resolve({content: mergedProperties, locale: locale});
      });
    }).catch((e) => {
      console.log(e);
      reject(e);
    });
  });
}

function processMessageFiles(locales) {
  return Promise.all(locales.map(getContentMessages));
}

getListLocales().then(processMessageFiles)
.then(writeFile).catch((err)=> {
  console.error(err);
});
