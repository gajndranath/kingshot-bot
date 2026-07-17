const express = require('express');
const logger = require('../utils/logger');

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

function initPaymentWebhookServer(prisma) {
  const app = express();
  const port = process.env.PORT || 3000;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // Stripe requires the raw body to construct the event
  app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];

    let event;

    try {
      // Security: Verify the cryptographic signature using our webhook secret
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      
    } catch (err) {
      logger.error(err, 'Webhook signature verification failed');
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle successful checkout
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      
      // We assume client_reference_id contains the Discord guild_id
      const guildId = session.client_reference_id; 

      if (guildId) {
        try {
          await prisma.subscription.update({
            where: { guild_id: guildId },
            data: { is_premium: true }
          });
          logger.info(`✅ Successfully upgraded Guild ${guildId} to PREMIUM.`);
        } catch (dbError) {
          logger.error(dbError, `Failed to update subscription for Guild ${guildId}`);
        }
      }
    }

    // Return a 200 response to acknowledge receipt of the event
    res.json({ received: true });
  });

  app.listen(port, () => {
    logger.info(`💳 Payment Webhook Server listening on port ${port}`);
  });
}

module.exports = {
  initPaymentWebhookServer
};
