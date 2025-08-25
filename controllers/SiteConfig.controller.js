import SiteConfig from '../models/HomeSetting.js';
import { createMediaEntry } from '../utils/createMediaEntry.js';

export const getSiteConfig = async (req, res) => {
    try {
        const config = await SiteConfig.findOne().populate([
            'header.0.adminLogo',
            'header.0.websiteLogo',
            'header.0.favicon',
            'header.0.loginPageImg',
            'footer.0.logo',
            'footer.0.footer.featureSets.one.image',
            'footer.0.footer.featureSets.two.image',
            'footer.0.footer.featureSets.three.image',
            'footer.0.footer.featureSets.four.image'
        ]);

        if (!config) {
            return res.status(404).json({ error: true, message: 'Site config not found' });
        }

        return res.status(200).json({ error: false, data: config });
    } catch (err) {
        console.error('Error fetching site config:', err);
        return res.status(500).json({ error: true, message: 'Internal server error' });
    }
};






export const upsertSiteConfig = async (req, res) => {
    try {
        const uploadedBy = req.user?._id || req.body.uploadedBy;

        const getMedia = async (fieldName, existingVal = null) => {
            const file = req.files?.find(f => f.fieldname === fieldName);
            if (file) {
                return await createMediaEntry(file, uploadedBy);
            }
            return existingVal;
        };

        const existing = await SiteConfig.findOne();

        // 🆕 Theme block
        // In your upsertSiteConfig function
        const theme = {
            fontFamily: req.body["theme.fontFamily"] || "",
            primaryColor: req.body["theme.primaryColor"] || "#3b82f6",
            secondaryColor: req.body["theme.secondaryColor"] || "#10b981",
            backgroundColor: req.body["theme.backgroundColor"] || "#ffffff",
            textColor: req.body["theme.textColor"] || "#000000",
            fontSize: req.body["theme.fontSize"] || "16px",
            fontWeight: req.body["theme.fontWeight"] || "400"
        };


        // 🆕 Parse promo block
        const promo = {
            text: req.body["promo.text"] || "",
            url: req.body["promo.url"] || "",
            text2: req.body["promo.text2"] || "",
            url2: req.body["promo.url2"] || "",
            text3: req.body["promo.text3"] || "",
            url3: req.body["promo.url3"] || "",
            showPromo: req.body["promo.showPromo"] === "true"
        };

        // 🆕 Coming Soon block
        const comingSoon = {
            enabled: req.body["comingSoon.enabled"] === "true",
            password: req.body["comingSoon.password"] || "",
            message: req.body["comingSoon.message"] || "Website Coming Soon",
            reason: req.body["comingSoon.reason"] || "",
            allowBypass: req.body["comingSoon.allowBypass"] === "false" ? false : true
        };

        const configPayload = {
            header: [{
                scripts: {
                    header: req.body["scripts.header"] || "",
                    body: req.body["scripts.body"] || ""
                },
                header: {
                    promo, // ✅ Injected promo block
                    showSearchBox: req.body["header.showSearchBox"] === "true",
                    headerMenu: [] // Optional: Populate if needed
                },
                isMaintenanceModeEnabled: req.body.isMaintenanceModeEnabled === "true" || false,
                siteTitle: req.body.siteTitle || "",
                siteEmail: req.body.siteEmail || "",
                sitePhone: req.body.sitePhone || "",
                siteAddress: req.body.siteAddress || "",
                adminLogo: await getMedia("adminLogo", existing?.header?.[0]?.adminLogo),
                websiteLogo: await getMedia("websiteLogo", existing?.header?.[0]?.websiteLogo),
                favicon: await getMedia("favicon", existing?.header?.[0]?.favicon),
                loginPageImg: await getMedia("loginPageImg", existing?.header?.[0]?.loginPageImg),
            }],
            footer: [{
                scripts: {
                    footer: req.body["scripts.footer"] || ""
                },
                logo: await getMedia("footer.logo", existing?.footer?.[0]?.logo),
                socialLinks: {
                    facebook: req.body["socialLinks.facebook"] || "",
                    twitter: req.body["socialLinks.twitter"] || "",
                    instagram: req.body["socialLinks.instagram"] || "",
                    youtube: req.body["socialLinks.youtube"] || "",
                    linkedin: req.body["socialLinks.linkedin"] || ""
                },
                footer: {
                    button: {
                        text: req.body["footer.button.text"],
                        url: req.body["footer.button.url"],
                        showButton: req.body["footer.button.showButton"] === "true"
                    },
                    featureSets: {
                        one: {
                            title: req.body["featureSets.one.title"],
                            subtitle: req.body["featureSets.one.subtitle"],
                            url: req.body["featureSets.one.url"],
                            image: await getMedia("featureSets.one.image", existing?.footer?.[0]?.footer?.featureSets?.one?.image)
                        },
                        two: {
                            title: req.body["featureSets.two.title"],
                            subtitle: req.body["featureSets.two.subtitle"],
                            url: req.body["featureSets.two.url"],
                            image: await getMedia("featureSets.two.image", existing?.footer?.[0]?.footer?.featureSets?.two?.image)
                        },
                        three: {
                            title: req.body["featureSets.three.title"],
                            subtitle: req.body["featureSets.three.subtitle"],
                            url: req.body["featureSets.three.url"],
                            image: await getMedia("featureSets.three.image", existing?.footer?.[0]?.footer?.featureSets?.three?.image)
                        },
                        four: {
                            title: req.body["featureSets.four.title"],
                            subtitle: req.body["featureSets.four.subtitle"],
                            url: req.body["featureSets.four.url"],
                            image: await getMedia("featureSets.four.image", existing?.footer?.[0]?.footer?.featureSets?.four?.image)
                        }
                    },
                    showEmailSubscribe: req.body["footer.showEmailSubscribe"] === "true",
                    footerMenu: []
                }
            }],
            comingSoon,
            theme,
            error: req.body.error === "true" || false
        };

        let result;
        if (existing) {
            existing.header = configPayload.header;
            existing.footer = configPayload.footer;
            existing.comingSoon = configPayload.comingSoon;
            existing.theme = configPayload.theme;
            existing.error = configPayload.error;
            result = await existing.save();
        } else {
            result = await SiteConfig.create(configPayload);
        }

        return res.status(200).json({
            error: false,
            message: existing ? "Site config updated" : "Site config created",
            data: result
        });
    } catch (error) {
        console.error("❌ Error saving site config:", error);
        return res.status(500).json({
            error: true,
            message: "Internal server error",
            details: error.message
        });
    }
};
