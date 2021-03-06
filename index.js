const express = require('express');
const request = require('request');
const { middleware, errorMiddleware, asyncHandler, EnvoyResponseError, EnvoyAPI } = require('@envoy/envoy-integrations-sdk');
const PORT = 3000;
const app = express();
const vision = require('@google-cloud/vision');
const visionClient = new vision.ImageAnnotatorClient();
const axios = require('axios');
const cors = require('cors');
let envoyAPI = '';
let accessToken; // Debug only.
let refreshToken; // Debug only.

// Define scope for token here
const TOKEN_SCOPE = [
    'token.refresh',
    'locations.read',
    'companies.read',
    'flows.read',
    'invites.read',
    'invites.write',
    'employees.read',
    'reservations.read',
    'reservations.write',
    'spaces.read',
    'work-schedules.read',
    'work-schedules.write',
]

const ENTRY_TEST = {
    "data": {
        "attributes": {
            "locality": { "place-id": "143497" },
            "user-data": {
                "Purpose of visit": "Visiting",
                "Your Email Address": "nicole.j@adomain.tld",
                "Host": "Stephen Arsenault",
                "Your Full Name": "Nicole Jacinto"
            },
            "full-name": "Nicole Jacinto",
            "email": "nicole.j@adomain.tld",
            "private-notes": "This private note is optional and not visible to your visitor",
            "print-badge": false,
            "send-host-notification": false,
            "current-location-id": 143497,
            "flow-name": "Visitor",
            "finalized-at": "2022-06-06T15:52:00Z"
        },
        "relationships": {
            "location": {
                "data": {
                    "type": "locations",
                    "id": 143497
                }
            },
            "sign-in-user": {
                "data": {
                    "type": "locations",
                    "id": 143497
                }
            }
        },
        "type": "locations"
    }
}
// getAccessToken('https://app.envoy.com/a/auth/v0/token');
// getAccessToken('https://api.envoy.com/oauth2/token');

// Cors Middleware to handle cross origin request
// app.use(cors());
/**
 * "middleware()" returns an instance of bodyParser.json,
 * that also verifies the Envoy signature in addition to
 * parsing the request body as JSON.
 */
app.use(middleware());

app.use(errorMiddleware());

/** 
 * Get an access token generated from ENVOY_CLIENT_ID and ENVOY_CLIENT_SECRET provided from env file. 
 * Or use ENVOY_CLIENT_API_KEY which is currently in beta testing. 
 * Also see scopes here: https://developers.envoy.com/hub/docs/scopes#access-scopes for optional list of permissions for the token.
 * Token will eventually expire and is meant only to be used for testing envoyAPI in the brief time this app is ran. 
 * 
*/
async function getAccessToken(
    AuthURL,
    apiKey = process.env.ENVOY_CLIENT_API_KEY,
    devUser = process.env.API_USERNAME,
    devPassword = process.env.API_USER_PASSWORD,
) {

    var options = {
        'method': 'POST',
        'url': AuthURL,
        'headers': {
            'Authorization': 'Basic ' + apiKey,
            json: true
        },
        formData: {
            'username': devUser,
            'password': devPassword,
            'scope': TOKEN_SCOPE.join(),
            'grant_type': 'password',
        }
    };

    request(options, function (error, response) {
        if (error) throw new Error(error);
        accessToken = JSON.parse(response.body).access_token;
        refreshToken = JSON.parse(response.body).refresh_token;
        // console.log("\nAccess Token: " + accessToken + '\n', "\nRefresh Token: " + refreshToken);
        // envoyAPI = new EnvoyAPI(accessToken);
    });
}

/*
    Get acccess token from auth code provided by external OAuth redirect url.
*/
async function getAccessTokenFromAuthCode(authCode) {
    const response = await axios.post(
        'https://app.envoy.com/a/auth/v0/token',
        {
            'grant_type': 'authorization_code',
            'code': authCode,
            'client_id': process.env.ENVOY_CLIENT_ID,
            'client_secret': process.env.ENVOY_CLIENT_SECRET,
        },
        {
            headers: {
                'Content-Type': 'application/json'
            }
        }
    ).then(res => {
        return res.data;
    }).catch(error => {
        return error;
    });

    if (response.access_token) {
        return {
            accessToken: response.access_token,
            refreshToken: response.refresh_token,
        }
    } else {
        return response;
    }
}

async function refreshAccessToken(refreshToken) {
    const response = await axios.post(
        'https://app.envoy.com/a/auth/v0/token',
        {
            'grant_type': 'refresh_token',
            'refresh_token': refreshToken,
            'client_id': process.env.ENVOY_CLIENT_ID,
            'client_secret': process.env.ENVOY_CLIENT_SECRET,
        },
        {
            headers: {
                'Content-Type': 'application/json'
            }
        }
    ).then(res => {
        return res.data;
    }).catch(error => {
        return error;
    });

    return response.access_token;
}

/**
 * Default landing page. Place any API calls here to be ran on page load. 
 * A useful company id for testing is 110090, Test Company 1. LocationId : 143497
 */
// app.get('/', asyncHandler(async (req, res) => {
//     const { envoy } = req;  // "envoy" is the SDK
//     let result = {};
//     result.locations = await envoyAPI.location('143497');
//     /*
//     // Test cases

//     // Locations

//     // Companies
//     result.company = await envoyAPI.companies(); 

//     // Employee Import
//     // Possible deprecated API?
//     // Try this URL https://app.envoy.com/a/visitors/api/v3/employees/upload
//     // result.employeeRecords = await envoyAPI.importEmployeeRecords('asdf', '4d0e94e558795d6a31ec14dde63d6235');

//     // Entry
//     result.entry = await envoyAPI.entry('108010371');
//     result.entryPatch = await envoyAPI.patchEntry({
//         'entry-id': '108010371',
//         'X-CSRF-Token': '6b742fe43c754d7dc4f14ba67xxxxxxxxbe1d7faca6d38637f37f11xxxxxxxx',
//         'Accept': "{\"data\":{\"attributes\":{\"locality\":{\"place-id\":\"143497\"},\"user-data\":{\"Purpose of visit\":\"Visiting\",\"Your Email Address\":\"nicole.j@adomain.tld\",\"Host\":\"Stephen Arsenault\",\"Your Full Name\":\"Nicole Jacinto\"},\"full-name\":\"Nicole Jacinto\",\"email\":\"nicole.j@adomain.tld\",\"private-notes\":\"This private note is optional and not visible to your visitor\",\"print-badge\":false,\"send-host-notification\":false,\"current-location-id\":46424,\"flow-name\":\"Visitor\",\"finalized-at\":\"2019-07-17T10:52:00Z\"},\"relationships\":{\"location\":{\"data\":{\"type\":\"locations\",\"id\":36960}},\"sign-in-user\":{\"data\":{\"type\":\"locations\",\"id\":36960}}},\"type\":\"locations\"}}"
    
//     }) 
//     result.createEntry = await envoyAPI.createEntry(ENTRY_TEST); 

//     result.getEntries = await envoyAPI.getEntriesByDate({
//         location: 143497,
//         limit: 25,
//         offset: 0,
//         start_date: '2019-01-02',
//         end_date: '2022-06-01'
//     })

//     // Work Schedule 
//     result.workSchedules = await envoyAPI.workSchedules({createdAtAfter: "2021-06-06T15:52:00Z"});   
//     result.workSchedule = await envoyAPI.workSchedule('36554098');   
//     result.createWorkSchedule = await envoyAPI.createWorkSchedule({
//         workSchedule: {
//             locationId: 143497,
//             email: 'tkla+sdk@envoy.com',
//             expectedArrivalAt: '1900-06-06T15:52:00Z'    
//         }
//     }) 
//     // result.deleteWorkSchedule = await envoyAPI.deleteWorkSchedule(36766342); 
          
//     // Check In
//     result.checkIn = await envoyAPI.checkInWork(36766996);
//     result.checkIn = await envoyAPI.checkOutWork(36766996);
     
//     */

//     // Invites
//     // result.invites = await envoyAPI.getInvite(29168507);
//     // See invites API documentation for all params.
//     // result.invites = await envoyAPI.getInvites({
//     //     locationId: 143497,
//     //     page: 1,
//     //     perPage: 100
//     // })

//     // result.createInvite = await envoyAPI.createInviteV1({
//     //     "invite": {
//     //         "expectedArrivalAt": "2011-12-03T10:15:30Z",
//     //         "invitee": {
//     //             "name": "Benny Ka"
//     //         },
//     //         "locationId": 143497

//     //     } 
//     // });  

//     // result.updateInvite = await envoyAPI.updateInviteV1(36947980,{
//     //     "invite": {
//     //         "expectedArrivalAt": "2010-12-03T10:15:30Z",
//     //         "invitee": {
//     //             "name": "Who?"
//     //         },
//     //         "locationId": 143497

//     //     }
//     // })
//     // result.removeInvite = await envoyAPI.removeInvite(36752252);


//     // Reservations.
//     // result.reserve = await envoyAPI.reservations(); 
//     // result.reserve = await envoyAPI.reservation(2); 
//     // result.reserve = await envoyAPI.createReservation(); 
//     // result.reserve = await envoyAPI.checkInReservation(3);
//     // result.reserve = await envoyAPI.checkOutReservation(234);
//     // result.reserve = await envoyAPI.cancelReservation(4);

//     // Spaces
//     // result.space = await envoyAPI.space(324);
//     // result.spaces = await envoyAPI.spaces({
//     //     locationIds: 143497,
//     //     page: 1,
//     //     perPage: 100
//     // });

//     res.send(result);
// }));

app.get('/', asyncHandler(async (req, res) => {
    let test = await getAccessToken('https://api.envoy.com/oauth2/token');
    // axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    console.log(accessToken);
    var config = {
        method: 'get',
        baseURL: 'https://api.envoy.com/v1',
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    };

    axios('/companies', config)
        .then(function (response) {
            console.log(JSON.stringify(response.data));
            res.send(response.data);
        })
        .catch(function (error) {
            console.log(error.message);
            res.send(error);
        });
}))

app.get('/external-login', asyncHandler(async (req, res) => {
    // let baseURL = 'https://app.envoy.com/a/auth/v0/authorize?response_type=code';
    // let clientID = `&client_id=${process.env.ENVOY_CLIENT_ID}`;
    // let redirectURI = `&redirect_uri=https://envoy-test-sdk.herokuapp.com/external-login`;
    // let scope = `&scope=` + TOKEN_SCOPE.join('+');

    // let redirectURL = baseURL + clientID + redirectURI + scope;
    // res.redirect(redirectURL);
    // res.send("Hello");
    let authCode = req.query.code;
    res.header("Access-Control-Allow-Origin", "*");
    let tokens = await getAccessTokenFromAuthCode(authCode);
    res.json(tokens);
}))

app.post('/plugin-login', asyncHandler(async (req, res) => {
    console.log(req.body);
    let clientApiKey = req.body.payload.client_api_key || process.env.ENVOY_CLIENT_API_KEY;
    let username = req.body.payload.dev_id;
    let password = req.body.payload.dev_password;

    getAccessToken('https://api.envoy.com/oauth2/token', clientApiKey, username, password);
    res.send('Success');
}));

app.get('/employee-sign-in', asyncHandler(async (req, res) => {
    const { envoy } = req;
    res.send('Sign In Hook Test');
}));

app.post('/photo', asyncHandler(async (req, res) => {
    const [result] = await visionClient.logoDetection('./resources/google-logo.webp');
    const labels = result.labelAnnotations;
    const logos = result.logoAnnotations;
    // console.log('Logos:');
    logos.forEach(logo => console.log(logo));
    res.send(logos);
}))



const listener = app.listen(process.env.PORT || 0, () => {
    console.log(`Listening on port ${listener.address().port}`);
});