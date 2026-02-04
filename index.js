import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the local dist folder (Self-contained for ZIP)
app.use(express.static(path.join(__dirname, 'dist')));
// Fallback for development structure
app.use(express.static(path.join(__dirname, '../client/dist')));

// Mirroring the WORKING Bot Configuration
const IG_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Cookie': `sessionid=${process.env.IG_SESSION_ID}; ds_user_id=${process.env.IG_DS_USER_ID};`,
    'x-ig-app-id': '936619743392459',
    'Accept': '*/*',
    'Referer': 'https://www.instagram.com/',
};

// --- DATA FETCHING (Using Axios to MATCH the Bot) ---

async function getTargetId(username) {
    try {
        console.log(`🔍 Bot Search for: ${username}`);
        const searchUrl = `https://www.instagram.com/web/search/topsearch/?context=blended&query=${encodeURIComponent(username)}`;
        const res = await axios.get(searchUrl, { headers: IG_HEADERS, timeout: 10000 });

        const user = res.data.users?.find(u => u.user.username.toLowerCase() === username.toLowerCase());
        if (user) {
            const u = user.user;
            return {
                id: u.pk || u.id,
                username: u.username,
                fullName: u.full_name,
                profilePic: u.profile_pic_url,
                isPrivate: u.is_private
            };
        }
    } catch (e) {
        console.error('Bot-style search failed:', e.message);
    }
    return null;
}

async function fetchStories(targetId) {
    // Try primary reel_media endpoint (Bot's logic)
    try {
        console.log(`📡 Fetching stories for: ${targetId}`);
        const url = `https://i.instagram.com/api/v1/feed/user/${targetId}/reel_media/`;
        const res = await axios.get(url, { headers: IG_HEADERS, timeout: 15000 });
        return res.data.items || [];
    } catch (e) {
        console.warn('🔄 Primary fetch failed, trying fallback reels_media tray...');
        try {
            const url = `https://i.instagram.com/api/v1/feed/reels_media/?reel_ids=${targetId}`;
            const res = await axios.get(url, { headers: IG_HEADERS, timeout: 15000 });
            if (res.data.reels && res.data.reels[targetId]) {
                return res.data.reels[targetId].items || [];
            }
        } catch (err) {
            console.error('❌ All fetch attempts failed:', err.message);
        }
    }
    return [];
}

// --- API ROUTES ---

app.get('/api/stories', async (req, res) => {
    const { username } = req.query;

    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    try {
        const user = await getTargetId(username.trim());

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        if (user.isPrivate) {
            return res.status(403).json({ error: 'This account is private.', user });
        }

        const items = await fetchStories(user.id);

        const stories = items.map(item => {
            const isVideo = !!item.video_versions;
            return {
                id: item.id,
                mediaType: isVideo ? 'video' : 'image',
                mediaUrl: isVideo ? item.video_versions[0].url : item.image_versions2.candidates[0].url,
                takenAt: item.taken_at,
                expiringAt: item.expiring_at
            };
        });

        res.json({
            user,
            stories,
            hasStories: stories.length > 0
        });

    } catch (error) {
        console.error('API Error:', error.message);
        res.status(500).json({ error: 'Failed to connect to Instagram.' });
    }
});

// Catch-all for SPA
app.get('*', (req, res) => {
    // Try local /dist/index.html first
    const distPath = path.join(__dirname, 'dist', 'index.html');
    res.sendFile(distPath, (err) => {
        if (err) {
            // Fallback to dev path
            res.sendFile(path.join(__dirname, '../client/dist/index.html'));
        }
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Website (Axios + Bot-Logic) on port ${PORT}`);
});
