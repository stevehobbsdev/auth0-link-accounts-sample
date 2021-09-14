"use strict";

const debug = require("debug")("auth0-link-accounts-sample");

const router = require("express").Router();
const auth0Client = require("../Auth0Client");
const { Errors, clear } = require("../flashErrors");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* GET user profile. */
router.get("/", async (req, res) => {
  const { sub, email_verified } = req.openid.user;
  //fetch user profile containing the user_metadata and app_metadata properties
  try {
    let getUsersWithSameVerifiedEmail = [];
    const getUserProfile = auth0Client.getUser(sub);

    if (email_verified) {
      // account linking is only offered verified email
      getUsersWithSameVerifiedEmail = auth0Client.getUsersWithSameVerifiedEmail(
        req.openid.user
      );
    }

    const [user, suggestedUsers, connections] = await Promise.all([
      getUserProfile,
      getUsersWithSameVerifiedEmail,
      auth0Client.getConnections({ fields: "name,enabled_clients" }),
    ]);

    const connection = connections.find(
      (c) => c.name === user.identities[0].connection
    );

    const clientMemo = {};

    await Promise.all(
      suggestedUsers.map(async (user) => {
        const connection = connections.find(
          (c) => c.name === user.identities[0].connection
        );

        const clients = [];

        await connection.enabled_clients.reduce(async (memo, clientId) => {
          await memo;
          await sleep(100);

          if (!clientMemo[clientId]) {
            clientMemo[clientId] = await auth0Client.getClient(
              clientId,
              "name"
            );
          }

          clients.push(clientMemo[clientId]);
        }, Promise.resolve());

        user.clients = clients;
      })
    );

    const flashError = clear(req);

    res.render("user", {
      user,
      suggestedUsers,
      wrongAccountError: flashError && flashError === Errors.WrongAccount,
      connection,
    });
  } catch (err) {
    debug("GET /user[s] failed: %o", err);
    res.render("error", err);
  }
});

module.exports = router;
