var gCollectionObserver = null,
    gEventsCollection = null;

function meteorStart(options) {
    
    gEventsCollection = new DataCollection();
    
    var collectionCursor = options.collectionCursor ? options.collectionCursor : options.collection.find();
    
    var CollectionPerformerObj = new CollectionPerformer(options.collection, options.methods);

    /*
    gEventsCollection.add(this.attachEvent("onEventLoading", function(event) {
        CollectionPerformerObj.save(event);
        return true;
    }));
    */

    gEventsCollection.add(this.attachEvent("onEventChanged", function(eventId, event) {
        CollectionPerformerObj.save(event);
    }));

    gEventsCollection.add(this.attachEvent("onEventDeleted", function(eventId) {
        CollectionPerformerObj.remove(eventId);
    }));

    gEventsCollection.add(this.attachEvent("onEventAdded", function(eventId, event) {
        CollectionPerformerObj.save(event);
    }));

    var self = this,
        events = [],
        render = null;

    gCollectionObserver = collectionCursor.observe({

        added: function(data) {
            var eventData = parseEventData(data);
            if(!self.getEvent(eventData.id))
                events.push(eventData);

            //Timeout need for recurring events.
            clearTimeout(render);
            render = setTimeout(function() {
                self.parse(events, "json");
                events = [];
            }, 5);


        },

        changed: function(data) {
            var eventData = parseEventData(data),
                event = self.getEvent(eventData.id);

            if(!event)
                return false;

            for(var key in eventData)
                event[key] = eventData[key];

            self.updateEvent(eventData.id);
            return true;
        },

        removed: function(data) {
            if(self.getEvent(data.id))
                self.deleteEvent(data.id);
        }

    });

}

function meteorStop() {
    if(gCollectionObserver)
        gCollectionObserver.stop();

    var self = this;
    if(gEventsCollection) {
        gEventsCollection.each(function(eventId) {
            self.detachEvent(eventId);
        });
        gEventsCollection.clean();
    }
}

function CollectionPerformer(collection, methods) {

    this.save = function(event) {
        event = parseEventData(event);

        if(event.id.indexOf("#") + 1)
            return false;

        var savedEventData = this.findEvent(event.id);
        if(savedEventData) {
            if(methods && methods.update) {
                methods.update.call({_id:savedEventData._id, updateSetObject: event}); 
            } else {
                collection.update({_id: savedEventData._id}, {$set: event});
            }
        } else {
            if(methods && methods.insert) {
                methods.insert.call({objectToSave: event});
            } else {
                collection.insert(event);
            }    
            
        }
        return true;
    };

    this.remove = function(eventId) {
        var savedEventData = this.findEvent(eventId);
        if(savedEventData) {
            if(methods && methods.remove) {
                methods.remove.call({_id : savedEventData._id});    
            } else {
                collection.remove(savedEventData._id);   
            }
            
        }
    };

    this.findEvent = function(eventId) {
        return collection.findOne({id: eventId});
    };
}

function parseEventData(event) {
    var eventData = {};
    for(var eventProperty in event) {
        if(eventProperty.charAt(0) == "_")
            continue;

        eventData[eventProperty] = event[eventProperty];

        if(eventProperty == "id")
            eventData[eventProperty] = eventData[eventProperty].toString();
    }

    return eventData;
}

function DataCollection() {
    var collectionData = {},
        currentUid = new Date().valueOf();

    function _uid() {
        return currentUid++;
    }

    this.add = function(data) {
        var dataId = _uid();
        collectionData[dataId] = data;
        return dataId;
    };

    this.each = function(handler) {
        for(var key in collectionData)
            handler.call(this, collectionData[key]);
    };

    this.clean = function() {
        collectionData = {};
    };
}



function initSchedulerMeteor(scheduler) {
    scheduler.meteor = meteorStart;
    scheduler.meteorStop = meteorStop;
}

if(window.Scheduler) {
    Scheduler.plugin(function(scheduler) {
        initSchedulerMeteor(scheduler);
    });
}
else
    initSchedulerMeteor(scheduler);
