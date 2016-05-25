'use strict';

var _ = require('lodash');
var async = require('async');

module.exports = function (options) {
  var seneca = this;
  var plugin = 'test-event-data';
  var eventpin = seneca.pin({ role: 'cd-events', cmd: '*' });


  seneca.add({ role: plugin, cmd: 'insert' }, function (args, done) {

    console.log('Starting insert events');
    var events = require('../fixtures/events.json');

    var registerEvents = function(done) {
      seneca.act({role: 'cd-dojos', cmd: 'list', query: {verified: 1} }, function(err, dojos) {
        if(err) return done(err);
        async.eachSeries(dojos, function(dojo, cb){
          async.eachSeries(events, function(event, cbEvent){
            event.dojoId = dojo.id;
            event.dates.startTime = new Date();
            var endTime = new Date();
            event.dates.endTime = endTime.setMonth(endTime.getMonth() + 2);
            eventpin.saveEvent({eventInfo: event}, function(err, event){
              if (err) return done(err);
              cbEvent(null, event);
            });
          }, cb);
        }, done);
      });
    };

    //  TODO : waterfall ffs
    var registerEventAttendances = function(done) {
      var status = ['approved', 'pending', 'cancelled'];
      eventpin.listEvents({}, function(err, events){
        if (err) done(err);

        async.eachSeries(events, function(event, cbEvent){
          seneca.act({role: 'cd-dojos', cmd: 'load_dojo_users', query: {dojoId: event.dojoId}}, function (err, dojoUsers) {
            if (err) return done(err);

            eventpin.searchSessions({query: {eventId: event.id}}, function (err, sessions) {
              if (err) return done(err);
              event.sessions = sessions;
              async.eachSeries(event.sessions, function (session, doneSession) {
                seneca.act({role: 'cd-profiles', cmd: 'list', query: {userId: { in$: _.map(dojoUsers.response, 'id')}} }, function (err, users) {
                  if (err) return done(err);
                  async.eachSeries(users, function (user, cb) {

                    var application = {
                      name: user.name,
                      dateOfBirth: user.dob,
                      eventId: event.id,
                      status: Math.floor(Math.random() * (4)),
                      userId: user.userId,
                      ticketName: session.name,
                      ticketType: user.userType,
                      sessionId: session.id,
                      dojoId: event.dojoId
                    };
                    eventpin.saveApplication({application: application}, cb);
                  }, doneSession);
                });
              }, cbEvent);
            });
          });
        }, done);
      });
    };

    var callDone = function(done) {
      console.log('Sending done signal to previous µs');
      seneca.act({ role: plugin, cmd: 'done', timeout: false}, done);
    }

    async.series([
      registerEvents,
      registerEventAttendances,
      callDone
    ], done);

  });

  seneca.add({ role: plugin, cmd: 'clean' }, function (args, done) {
    var eventpin = seneca.pin({ role: 'event', cmd: '*' });

    var deleteEvents = function (cb) {
      async.eachSeries(events, eventpin.delete, cb);
    };

    var deleteApplication = function (cb) {
      eventpin.searchApplications({}, function(err, application){
        async.eachSeries(application, eventpin.deleteApplication, cb);
      });
    };

    async.series([
      deleteApplication,
      deleteEvents
    ], done);
  });

  seneca.add({ role: plugin, cmd: 'init'}, function (args, done) {
    seneca.act({ role: plugin, cmd: 'insert', timeout: false}, function(err){
      if(err) return done(err);
      done();
    });
  });

  seneca.add({ role: plugin, cmd: 'done'}, function (args, done){
    seneca.act({ role: 'test-dojo-data', cmd: 'done', timeout: false, ungate: true});
    console.log('Stopping event service');
    seneca.close();
    process.exit();
  });

  return {
    name: plugin
  };
};
