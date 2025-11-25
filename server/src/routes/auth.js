import express from 'express';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { userOps, credentialOps } from '../services/database.js';

const router = express.Router();

const rpName = 'RSS Reader';
// Use the hostname from the request
const getRpID = (req) => {
  // Check origin header first (most reliable)
  const origin = req.get('origin');
  if (origin) {
    try {
      const url = new URL(origin);
      return url.hostname;
    } catch (e) {
      // fallback
    }
  }
  
  // Fallback to host header
  const host = req.get('host') || 'localhost';
  // Extract base domain (remove port)
  return host.split(':')[0];
};

const getOrigin = (req) => {
  // Use the Origin header from the request (where the browser is)
  const origin = req.get('origin') || req.get('referer');
  if (origin) {
    // Remove trailing slash and path from referer
    return origin.replace(/\/$/, '').split('?')[0].split('#')[0];
  }
  // Fallback
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
  const host = req.get('host') || 'localhost:5173';
  return `${protocol}://${host}`;
};

// Get current user from session
router.get('/current-user', (req, res) => {
  if (req.session?.userId) {
    const user = userOps.get(req.session.userId);
    if (user) {
      return res.json({ 
        authenticated: true, 
        username: user.username 
      });
    }
  }
  res.json({ authenticated: false });
});

// Generate registration options
router.post('/register/options', async (req, res) => {
  const { username } = req.body;
  
  if (!username) {
    return res.status(400).json({ error: 'Username required' });
  }

  // Check if user exists
  let user = userOps.getByUsername(username);
  
  if (!user) {
    // Create new user with Uint8Array ID
    const userIdBuffer = new TextEncoder().encode(`user_${Date.now()}`);
    user = userOps.insert(username, userIdBuffer);
  }
  
  // Convert stored array back to Uint8Array
  const userIdBuffer = new Uint8Array(user.idBuffer);

  const rpID = getRpID(req);
  
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: username,
    userID: userIdBuffer,
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  // Store challenge in session
  req.session.registrationChallenge = options.challenge;
  
  // Store user ID in session
  req.session.userId = user.id;

  res.json(options);
});

// Verify registration
router.post('/register/verify', async (req, res) => {
  const userId = req.session?.userId;
  
  if (!userId) {
    return res.status(400).json({ error: 'No session' });
  }

  const user = userOps.get(userId);
  const expectedChallenge = req.session.registrationChallenge;

  if (!user || !expectedChallenge) {
    return res.status(400).json({ error: 'Invalid session' });
  }

  try {
    const rpID = getRpID(req);
    const origin = getOrigin(req);
    
    console.log('Verifying registration:', { rpID, origin, expectedChallenge });
    
    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (verification.verified && verification.registrationInfo) {
      const { credential } = verification.registrationInfo;
      
      // Store credential in database
      credentialOps.insert(userId, {
        id: credential.id,
        publicKey: credential.publicKey,
        counter: credential.counter,
        transports: req.body.response.transports,
      });

      delete req.session.registrationChallenge;

      console.log('Registration successful for user:', user.username);
      res.json({ verified: true });
    } else {
      console.log('Registration verification failed');
      res.json({ verified: false });
    }
  } catch (error) {
    console.error('Registration verification error:', error.message);
    console.error('Full error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Generate authentication options
router.post('/login/options', async (req, res) => {
  const { username } = req.body;

  let allowCredentials = undefined;

  if (username) {
    const user = userOps.getByUsername(username);
    if (user) {
      const credentials = credentialOps.getByUserId(user.id);
      if (credentials.length > 0) {
        allowCredentials = credentials.map(cred => ({
          id: cred.id,
          transports: cred.transports,
        }));
      }
    }
  }

  const rpID = getRpID(req);
  
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials,
    userVerification: 'preferred',
  });

  // Store challenge in session
  req.session.currentChallenge = options.challenge;

  res.json(options);
});

// Verify authentication
router.post('/login/verify', async (req, res) => {
  const { id: credentialId } = req.body;

  // Find user by credential
  const credential = credentialOps.getById(credentialId);
  
  if (!credential) {
    return res.status(400).json({ error: 'Credential not found' });
  }
  
  const user = userOps.get(credential.user_id);
  
  if (!user) {
    return res.status(400).json({ error: 'User not found' });
  }
  
  // Convert stored array back to Uint8Array
  const publicKey = new Uint8Array(credential.publicKey);

  const expectedChallenge = req.session.currentChallenge;
  
  if (!expectedChallenge) {
    return res.status(400).json({ error: 'No challenge found in session' });
  }

  try {
    const rpID = getRpID(req);
    const origin = getOrigin(req);
    
    console.log('Verifying authentication:', { rpID, origin, expectedChallenge });
    
    const verification = await verifyAuthenticationResponse({
      response: req.body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credential.id,
        publicKey: publicKey,
        counter: credential.counter,
      },
    });

    if (verification.verified) {
      // Update counter in database
      credentialOps.updateCounter(credential.id, verification.authenticationInfo.newCounter);

      // Set session
      req.session.userId = user.id;
      delete req.session.currentChallenge;

      console.log('Authentication successful for user:', user.username);
      res.json({ 
        verified: true,
        username: user.username 
      });
    } else {
      console.log('Authentication verification failed');
      res.json({ verified: false });
    }
  } catch (error) {
    console.error('Authentication verification error:', error.message);
    console.error('Full error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

export default router;
