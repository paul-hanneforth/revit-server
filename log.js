const incrementCounter = (eventObject) => ({ ...eventObject, counter: eventObject.counter + 1 });


// global
var globalEvents = {}


module.exports = {
    event: (eventName) => {

        const eventObject = globalEvents[eventName] ? globalEvents[eventName] : { name: eventName, counter: 0 }
        
        return {
            trigger: () => {
                // update eventObject
                const updatedEventObject = incrementCounter(eventObject);
                // update global events
                globalEvents[eventName] = updatedEventObject;
            }
        }

    },
    export: () => globalEvents
}