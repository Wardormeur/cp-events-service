'use strict';
var _ = require('lodash');

var config = require('../config/config.js')();

var seneca = require('seneca')();


var argv = require('optimist')
  .boolean('d')
  .alias('d', 'withcleanup')
  .argv;

seneca.log.info('using config', JSON.stringify(config, null, 4));
seneca.options(config);

seneca.use('postgresql-store');

seneca
  .use('../lib/cd-events.js')
  .use(require('../test/lib/test-event-data.js'))
  .listen()
  .client({type: 'web', port: 10301, pin: 'role:cd-dojos,cmd:*'})
  .client({type: 'web', port: 10301, pin: 'role:test-dojo-data,cmd:*'})
  .client({type: 'web', port: 10303, pin: 'role:cd-profiles,cmd:*'});


seneca.ready(function() {
  function docleanup(done) {
    if (argv.withcleanup) {
      seneca.act({ role: 'test-event-data', cmd: 'clean', timeout: false }, done);
    }
    else {
      setImmediate(done);
    }
  }

  docleanup( function () {
    console.log('Service cleaned');
    console.log('Service ready for initialization');
  });

});
