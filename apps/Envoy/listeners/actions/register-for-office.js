const { registerBuilder } = require('../../user-interface/modals');
/**  
 * Event to run when register button on home is clicked.  .action listens for UI interactions like button clicks. 
 */
const registerForOffice = async function({ack, payload, client, body, context}) {
  await ack();
  const triggerId = body.trigger_id;
  const locationsMeta = context.locations;
  const locations = locationsMeta.map((locationObject) => {
    return {locationName: locationObject.attributes.name, locationId: locationObject.id};
  });
  const userId = body.user.id;
  const user = await client.users.profile.get({user: userId});
  const userEmail = user.profile.email;
  const modal = registerBuilder(locations, userEmail);
  try {
    await client.views.open({
      /* the user who opened the modal */
      user_id: payload.user,
      /* the event that opened the modal is stored on body for an action */
      trigger_id: triggerId,
      /* the view object that makes the modal */
      view: modal
    });

  }
  catch (error) {
    console.error(error);
  }
};

module.exports = { registerForOffice };