const createInviteBuilder = require('./createInviteBuilder');
/**  
 * Shortcut option to open invite modal.  .shortcut listens for global/message shortcuts (found in the + menu near the message bar). 
 */
const shortcutCreateInvite = async function({ack, client, payload, context}) {
    await ack();
    const locationsMeta = await context.envoy.API.locations();
    const locations = locationsMeta.map((locationObject) => {
      return {locationName: locationObject.attributes.name, locationId: locationObject.id};
    });
  const modal = createInviteBuilder(locations);
  try {
    const response = await client.views.open({
      /* the user who opened the modal */
      user_id: payload.user,
      /* the event that opened the modal */
      trigger_id: payload.trigger_id,
      /* the view object that makes the modal */
      view: modal
    });
    console.log(response);
  }
  catch (error) {
    console.error(error);
  }
};

module.exports = shortcutCreateInvite;