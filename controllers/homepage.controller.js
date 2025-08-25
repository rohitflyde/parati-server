import Homepage from "../models/HomePageContent.js";
import { createMediaEntry } from "../utils/createMediaEntry.js";

// Get hero products
export const getHeroProducts = async (req, res) => {
  try {
    let homepage = await Homepage.findOne().populate("hero.latestLaunches.image");
    if (!homepage) {
      homepage = await Homepage.create({ hero: { latestLaunches: [] } });
    }
    res.json({ success: true, data: homepage.hero.latestLaunches });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const addHeroProduct = async (req, res) => {

  console.log('prod data: ', req.body)
  try {
    let homepage = await Homepage.findOne();
    if (!homepage) {
      homepage = await Homepage.create({ hero: { latestLaunches: [] } });
    }

    let imageId = null;
    if (req.files && req.files.length > 0) {
      imageId = await createMediaEntry(req.files[0], req.user?._id || null);
    }

    // Parse highlights from request body
    let highlights = [];
    if (req.body.highlights) {
      // If highlights is sent as an array of objects
      if (Array.isArray(req.body.highlights)) {
        highlights = req.body.highlights;
      }
      // If highlights are sent as individual fields (form data)
      else if (req.body['highlights[0][label]']) {
        // Parse form-data format highlights
        highlights = [];
        let i = 0;
        while (req.body[`highlights[${i}][label]`] !== undefined) {
          highlights.push({
            label: req.body[`highlights[${i}][label]`] || '',
            subLabel: req.body[`highlights[${i}][subLabel]`] || '',
            description: req.body[`highlights[${i}][description]`] || ''
          });
          i++;
        }
      }
    }

    const newProduct = {
      title: req.body.title,
      slug: req.body.slug,
      sku: req.body.sku || "",
      category: req.body.category || "",
      highlights: highlights, // Add highlights field
      brandTag: req.body.brandTag || "AiTel Generative AI",
      emiText: req.body.emiText || "EMI starts at ₹492. No Cost EMI available",
      descriptionText:
        req.body.descriptionText ||
        "Blazing Fast Interface and Insane AI Features",
      categoryLinkText: req.body.categoryLinkText || "All {category}",
      mrp: parseFloat(req.body.mrp) || 0,
      sp: parseFloat(req.body.sp) || 0,
      image: imageId,
    };

    homepage.hero.latestLaunches.push(newProduct);
    await homepage.save();

    // Populate the image field before sending response
    await homepage.populate("hero.latestLaunches.image");

    res.json({ success: true, data: homepage.hero.latestLaunches });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update hero product
export const updateHeroProduct = async (req, res) => {
  console.log('update prod data: ', req.body)
  try {
    const { productId } = req.params;
    const homepage = await Homepage.findOne();
    if (!homepage)
      return res.status(404).json({ message: "Homepage not found" });

    const productIndex = homepage.hero.latestLaunches.findIndex(
      (p) => p._id.toString() === productId
    );
    if (productIndex === -1)
      return res.status(404).json({ message: "Product not found" });

    let imageId = homepage.hero.latestLaunches[productIndex].image;
    if (req.files && req.files.length > 0) {
      imageId = await createMediaEntry(
        req.files[0],
        req.user?._id || null
      );
    }

    // Parse highlights from request body
    let highlights = homepage.hero.latestLaunches[productIndex].highlights;
    if (req.body.highlights) {
      // If highlights is sent as an array of objects
      if (Array.isArray(req.body.highlights)) {
        highlights = req.body.highlights;
      }
      // If highlights are sent as individual fields (form data)
      else if (req.body['highlights[0][label]']) {
        // Parse form-data format highlights
        highlights = [];
        let i = 0;
        while (req.body[`highlights[${i}][label]`] !== undefined) {
          highlights.push({
            label: req.body[`highlights[${i}][label]`] || '',
            subLabel: req.body[`highlights[${i}][subLabel]`] || '',
            description: req.body[`highlights[${i}][description]`] || ''
          });
          i++;
        }
      }
    }

    // Update the product with new data
    homepage.hero.latestLaunches[productIndex] = {
      ...homepage.hero.latestLaunches[productIndex]._doc,
      title: req.body.title || homepage.hero.latestLaunches[productIndex].title,
      slug: req.body.slug || homepage.hero.latestLaunches[productIndex].slug,
      sku: req.body.sku || homepage.hero.latestLaunches[productIndex].sku,
      category:
        req.body.category || homepage.hero.latestLaunches[productIndex].category,
      highlights: highlights, // ADD THIS LINE - Save highlights to database
      brandTag:
        req.body.brandTag !== undefined
          ? req.body.brandTag
          : homepage.hero.latestLaunches[productIndex].brandTag,
      emiText:
        req.body.emiText !== undefined
          ? req.body.emiText
          : homepage.hero.latestLaunches[productIndex].emiText,
      descriptionText:
        req.body.descriptionText !== undefined
          ? req.body.descriptionText
          : homepage.hero.latestLaunches[productIndex].descriptionText,
      categoryLinkText:
        req.body.categoryLinkText !== undefined
          ? req.body.categoryLinkText
          : homepage.hero.latestLaunches[productIndex].categoryLinkText,
      mrp: req.body.mrp
        ? parseFloat(req.body.mrp)
        : homepage.hero.latestLaunches[productIndex].mrp,
      sp: req.body.sp
        ? parseFloat(req.body.sp)
        : homepage.hero.latestLaunches[productIndex].sp,
      image: imageId,
    };

    await homepage.save();

    // Populate the image field before sending response
    await homepage.populate("hero.latestLaunches.image");

    res.json({ success: true, data: homepage.hero.latestLaunches });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete hero product
export const deleteHeroProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const homepage = await Homepage.findOne();
    if (!homepage)
      return res.status(404).json({ message: "Homepage not found" });

    const productIndex = homepage.hero.latestLaunches.findIndex(
      (p) => p._id.toString() === productId
    );
    if (productIndex === -1)
      return res.status(404).json({ message: "Product not found" });

    homepage.hero.latestLaunches.splice(productIndex, 1);
    await homepage.save();

    // Populate the image field before sending response
    await homepage.populate("hero.latestLaunches.image");

    res.json({ success: true, data: homepage.hero.latestLaunches });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};






export const getBanners = async (req, res) => {
  try {
    let homepage = await Homepage.findOne()
      .populate("banners.mobileImage")
      .populate("banners.desktopImage");

    if (!homepage) {
      homepage = await Homepage.create({ banners: [] });
    }

    // Sort banners by order
    const sortedBanners = homepage.banners.sort((a, b) => a.order - b.order);

    res.json({ success: true, data: sortedBanners });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Add new banner
export const addBanner = async (req, res) => {
  try {
    let homepage = await Homepage.findOne();
    if (!homepage) {
      homepage = await Homepage.create({ banners: [] });
    }

    let mobileImageId = null;
    let desktopImageId = null;

    // Handle multiple file uploads
    if (req.files && req.files.length > 0) {
      const mobileFile = req.files.find(file => file.fieldname === 'mobileImage');
      const desktopFile = req.files.find(file => file.fieldname === 'desktopImage');

      if (mobileFile) {
        mobileImageId = await createMediaEntry(mobileFile, req.user?._id || null);
      }

      if (desktopFile) {
        desktopImageId = await createMediaEntry(desktopFile, req.user?._id || null);
      }
    }

    const newBanner = {
      title: req.body.title,
      subtitle: req.body.subtitle,
      description: req.body.description,
      buttonText: req.body.buttonText || "Buy Now",
      buttonLink: req.body.buttonLink || "#",
      originalPrice: req.body.originalPrice ? parseFloat(req.body.originalPrice) : null,
      discountedPrice: req.body.discountedPrice ? parseFloat(req.body.discountedPrice) : null,
      mobileImage: mobileImageId,
      desktopImage: desktopImageId,
      gradientOverlay: req.body.gradientOverlay || "bg-gradient-to-b from-black/40 via-transparent to-pink-500/60",
      textPosition: req.body.textPosition || "left",
      isActive: req.body.isActive !== undefined ? req.body.isActive === 'true' : true,
      order: req.body.order ? parseInt(req.body.order) : homepage.banners.length
    };

    homepage.banners.push(newBanner);
    await homepage.save();

    await homepage.populate("banners.mobileImage");
    await homepage.populate("banners.desktopImage");

    res.json({ success: true, data: homepage.banners });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update banner
export const updateBanner = async (req, res) => {
  try {
    const { bannerId } = req.params;
    const homepage = await Homepage.findOne();

    if (!homepage) {
      return res.status(404).json({ message: "Homepage not found" });
    }

    const bannerIndex = homepage.banners.findIndex(
      (b) => b._id.toString() === bannerId
    );

    if (bannerIndex === -1) {
      return res.status(404).json({ message: "Banner not found" });
    }

    // Handle file uploads
    if (req.files && req.files.length > 0) {
      const mobileFile = req.files.find(file => file.fieldname === 'mobileImage');
      const desktopFile = req.files.find(file => file.fieldname === 'desktopImage');

      if (mobileFile) {
        homepage.banners[bannerIndex].mobileImage = await createMediaEntry(
          mobileFile,
          req.user?._id || null
        );
      }

      if (desktopFile) {
        homepage.banners[bannerIndex].desktopImage = await createMediaEntry(
          desktopFile,
          req.user?._id || null
        );
      }
    }

    // Update banner fields
    const banner = homepage.banners[bannerIndex];
    banner.title = req.body.title || banner.title;
    banner.subtitle = req.body.subtitle !== undefined ? req.body.subtitle : banner.subtitle;
    banner.description = req.body.description !== undefined ? req.body.description : banner.description;
    banner.buttonText = req.body.buttonText || banner.buttonText;
    banner.buttonLink = req.body.buttonLink || banner.buttonLink;
    banner.originalPrice = req.body.originalPrice ? parseFloat(req.body.originalPrice) : banner.originalPrice;
    banner.discountedPrice = req.body.discountedPrice ? parseFloat(req.body.discountedPrice) : banner.discountedPrice;
    banner.gradientOverlay = req.body.gradientOverlay || banner.gradientOverlay;
    banner.textPosition = req.body.textPosition || banner.textPosition;
    banner.isActive = req.body.isActive !== undefined ? req.body.isActive === 'true' : banner.isActive;
    banner.order = req.body.order ? parseInt(req.body.order) : banner.order;

    await homepage.save();

    await homepage.populate("banners.mobileImage");
    await homepage.populate("banners.desktopImage");

    res.json({ success: true, data: homepage.banners });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete banner
export const deleteBanner = async (req, res) => {
  try {
    const { bannerId } = req.params;
    const homepage = await Homepage.findOne();

    if (!homepage) {
      return res.status(404).json({ message: "Homepage not found" });
    }

    const bannerIndex = homepage.banners.findIndex(
      (b) => b._id.toString() === bannerId
    );

    if (bannerIndex === -1) {
      return res.status(404).json({ message: "Banner not found" });
    }

    homepage.banners.splice(bannerIndex, 1);
    await homepage.save();

    res.json({ success: true, data: homepage.banners });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};