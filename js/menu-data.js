/**
 * The Cakery - Menu Data
 * Parsed from Main Menu.pdf & Bar Menu.pdf
 * All prices in PKR.
 *
 * Each item: { id, name, category, price, originalPrice?, desc, popular?, emoji }
 * No external images needed - we use emoji to keep the project self-contained.
 */

const MENU_DATA = [
  // ============ BREADS ============
  { id: 'br01', name: 'Baguette', category: 'breads', price: 350, desc: 'Classic French crusty baguette', imageUrl: 'images/products/baguette.jpg', emoji: '🥖' },
  { id: 'br02', name: 'Ciabatta', category: 'breads', price: 350, desc: 'Italian flat bread with airy crumb', imageUrl: 'images/products/ciabatta.jpg', emoji: '🥖' },
  { id: 'br03', name: 'Rosemary Focaccia', category: 'breads', price: 390, desc: 'Olive oil flatbread with rosemary', imageUrl: 'images/products/rosemary-focaccia.jpg', emoji: '🥖' },
  { id: 'br04', name: 'Olive & Rosemary Sourdough', category: 'breads', price: 750, desc: 'Slow-fermented sourdough with olives & rosemary', imageUrl: 'images/products/olive-rosemary-sourdough.jpg', emoji: '🥖' },
  { id: 'br05', name: 'Eight Grain Sourdough', category: 'breads', price: 850, desc: 'Hearty multi-grain sourdough loaf', imageUrl: 'images/products/eight-grain-sourdough.jpg', emoji: '🥖' },
  { id: 'br06', name: 'Raisin & Walnut Sourdough', category: 'breads', price: 850, desc: 'Sweet & nutty sourdough', imageUrl: 'images/products/raisin-walnut-sourdough.jpg', emoji: '🥖' },
  { id: 'br07', name: 'Whole-Wheat Sourdough', category: 'breads', price: 650, desc: 'Wholesome whole-wheat sourdough', emoji: '🥖' },
  { id: 'br08', name: 'House-Special Sourdough', category: 'breads', price: 750, desc: 'Our signature house sourdough', imageUrl: 'images/products/house-special-sourdough.jpg', emoji: '🥖', popular: true },
  { id: 'br09', name: 'Dark Seeded Sourdough', category: 'breads', price: 850, desc: 'Seeded dark crust sourdough', imageUrl: 'images/products/dark-sourdough.jpg', emoji: '🥖' },
  { id: 'br10', name: 'Bran Bread Loaf', category: 'breads', price: 290, desc: 'High-fibre bran bread loaf', imageUrl: 'images/products/bran-bread-loaf.jpg', emoji: '🍞' },
  { id: 'br11', name: 'Multi-Grain Loaf', category: 'breads', price: 450, desc: 'Multi-grain sandwich loaf', imageUrl: 'images/products/multi-grain-loaf.jpg', emoji: '🍞' },

  // ============ VIENNOISERIE ============
  { id: 'vi01', name: 'Butter Croissant', category: 'viennoiserie', price: 490, desc: 'Flaky buttery croissant', imageUrl: 'images/products/butter-croissant.jpg', emoji: '🥐', popular: true },
  { id: 'vi02', name: 'Pain au Chocolat', category: 'viennoiserie', price: 490, desc: 'Chocolate-filled croissant', imageUrl: 'images/products/pain-au-chocolat.jpg', emoji: '🥐' },
  { id: 'vi03', name: 'Almond Croissant', category: 'viennoiserie', price: 850, desc: 'Croissant topped with almond cream', imageUrl: 'images/products/almond-croissant.jpg', emoji: '🥐' },
  { id: 'vi04', name: 'Pistachio Crème Croissant', category: 'viennoiserie', price: 850, desc: 'Croissant filled with pistachio crème', imageUrl: 'images/products/pistachio-cr-me-croissant.jpg', emoji: '🥐' },
  { id: 'vi05', name: 'Pistachio Kunafa Croissant', category: 'viennoiserie', price: 1050, desc: 'Croissant with pistachio kunafa filling', imageUrl: 'images/products/pistachio-kunafa-croissant.jpg', emoji: '🥐' },
  { id: 'vi06', name: 'Pistachio Cruffin', category: 'viennoiserie', price: 590, desc: 'Croissant-muffin hybrid with pistachio', imageUrl: 'images/products/pistachio-cruffin.jpg', emoji: '🧁' },
  { id: 'vi07', name: 'Strawberry Cruffin', category: 'viennoiserie', price: 490, desc: 'Croissant-muffin with strawberry', imageUrl: 'images/products/strawberry-cruffin.jpg', emoji: '🧁' },
  { id: 'vi08', name: 'Nutella Croissant Bun', category: 'viennoiserie', price: 490, desc: 'Croissant bun with Nutella', imageUrl: 'images/products/nutella-croissant-bun.jpg', emoji: '🥐' },
  { id: 'vi09', name: 'Cream Cheese Croissant Bun', category: 'viennoiserie', price: 490, desc: 'Croissant bun with cream cheese', imageUrl: 'images/products/cream-cheese-croissant-bun.jpg', emoji: '🥐' },
  { id: 'vi10', name: 'Pain Suisse Chocolate', category: 'viennoiserie', price: 650, desc: 'Pain Suisse with chocolate', imageUrl: 'images/products/chocolate-pain-suisse.jpg', emoji: '🥐' },
  { id: 'vi11', name: 'Florentine Pepperoni', category: 'viennoiserie', price: 1150, desc: 'Savoury Florentine with pepperoni', imageUrl: 'images/products/florentine-pepperoni-suisse.jpg', emoji: '🥐' },

  // ============ PATISSERIE & DESSERTS — Éclairs ============
  { id: 'pa01', name: 'Èclairs - Nutella', category: 'patisserie', price: 350, desc: 'Choux pastry éclair filled with Nutella cream', imageUrl: 'images/products/nutella-clair.jpg', emoji: '🍮' },
  { id: 'pa02', name: 'Èclairs - Lotus Biscoff', category: 'patisserie', price: 350, desc: 'Éclair with Lotus Biscoff cream', imageUrl: 'images/products/lotus-biscoff-clair.jpg', emoji: '🍮' },

  // Mini Tarts
  { id: 'pa03', name: 'Mini Tart - Lemon', category: 'patisserie', price: 350, desc: 'Tangy lemon curd mini tart', imageUrl: 'images/products/lemon-mini-tart.jpg', emoji: '🥧' },
  { id: 'pa04', name: 'Mini Tart - Classic Chocolate', category: 'patisserie', price: 350, desc: 'Classic chocolate ganache mini tart', imageUrl: 'images/products/classic-chocolate-mini-tart.jpg', emoji: '🥧' },
  { id: 'pa05', name: 'Fruit Tart', category: 'patisserie', price: 490, desc: 'Custard tart with fresh fruits', imageUrl: 'images/products/mini-fruit-tart.jpg', emoji: '🥧' },

  // Tarts
  { id: 'pa06', name: 'Tart - Classic Chocolate', category: 'patisserie', price: 450, desc: 'Rich chocolate ganache tart', imageUrl: 'images/products/classic-chocolate-tart.jpg', emoji: '🥧' },
  { id: 'pa07', name: 'Tart - Banoffee', category: 'patisserie', price: 450, desc: 'Banana & toffee tart', imageUrl: 'images/products/banoffee-tart.jpg', emoji: '🥧' },
  { id: 'pa08', name: 'Tart - Lotus Biscoff', category: 'patisserie', price: 490, desc: 'Lotus Biscoff tart', imageUrl: 'images/products/lotus-biscoff-tart.jpg', emoji: '🥧' },
  { id: 'pa09', name: 'Tart - Coffee', category: 'patisserie', price: 620, desc: 'Coffee cream tart', imageUrl: 'images/products/coffee-tart.jpg', emoji: '🥧' },
  { id: 'pa10', name: 'Tart - Walnut', category: 'patisserie', price: 650, desc: 'Walnut & caramel tart', imageUrl: 'images/products/walnut-tart.jpg', emoji: '🥧' },
  { id: 'pa11', name: 'Tart - Almond', category: 'patisserie', price: 650, desc: 'Almond frangipane tart', imageUrl: 'images/products/almond-tart.jpg', emoji: '🥧' },
  { id: 'pa12', name: 'Tart - Lindt Chocolate', category: 'patisserie', price: 490, desc: 'Lindt chocolate tart', imageUrl: 'images/products/lindt-chocolate-tart.jpg', emoji: '🥧' },
  { id: 'pa13', name: 'Tart - Ferrero Rocher', category: 'patisserie', price: 650, desc: 'Ferrero Rocher hazelnut tart', imageUrl: 'images/products/ferrero-rocher-tart.jpg', emoji: '🥧' },
  { id: 'pa14', name: 'Tart - Pistachio Kunafa', category: 'patisserie', price: 820, desc: 'Pistachio kunafa tart', imageUrl: 'images/products/pistachio-kunafa-tart.jpg', emoji: '🥧' },

  // Opéra Cakes
  { id: 'pa15', name: 'Opèra Cake - Pistachio Hazelnut', category: 'patisserie', price: 750, desc: 'Layered opèra with pistachio & hazelnut', imageUrl: 'images/products/pistachio-hazelnut-opera-cake.jpg', emoji: '🍰' },
  { id: 'pa16', name: 'Opèra Cake - Ferrero Rocher', category: 'patisserie', price: 680, desc: 'Opèra with Ferrero Rocher', imageUrl: 'images/products/ferrero-rocher-opera-cake.jpg', emoji: '🍰' },
  { id: 'pa17', name: 'Opèra Cake - Orange Chocolate', category: 'patisserie', price: 680, desc: 'Orange & chocolate opèra', imageUrl: 'images/products/orange-chocolate-opera-cake.jpg', emoji: '🍰' },

  // Paris-Brest
  { id: 'pa18', name: 'Paris-Brest - Hazelnut', category: 'patisserie', price: 920, desc: 'Classic Paris-Brest with hazelnut cream', imageUrl: 'images/products/hazelnut-paris-brest.jpg', emoji: '🍰' },
  { id: 'pa19', name: 'Paris-Brest - Pistachio', category: 'patisserie', price: 920, desc: 'Paris-Brest with pistachio cream', imageUrl: 'images/products/pistachio-paris-brest.jpg', emoji: '🍰' },

  // Quiches
  { id: 'pa20', name: 'Quiche - Cheese & Mushroom', category: 'patisserie', price: 450, desc: 'Savoury quiche with cheese & mushroom', imageUrl: 'images/products/cheese-mushroom-quiche.jpg', emoji: '🥧' },
  { id: 'pa21', name: 'Quiche - Spinach & Tomato', category: 'patisserie', price: 450, desc: 'Quiche with spinach & tomato', imageUrl: 'images/products/spinach-tomato-quiche.jpg', emoji: '🥧' },
  { id: 'pa22', name: 'Chicken Vol-u-Vent', category: 'patisserie', price: 220, desc: 'Puff pastry shell with chicken filling', imageUrl: 'images/products/chicken-vol-u-vent.jpg', emoji: '🥧' },
  { id: 'pa23', name: 'Grilled Chicken Pattie', category: 'patisserie', price: 220, desc: 'Grilled chicken pattie', imageUrl: 'images/products/grilled-chicken-pattie.jpg', emoji: '🍗' },
  { id: 'pa24', name: 'Almond Crunch Granola', category: 'patisserie', price: 1650, desc: 'House-made almond crunch granola pack', emoji: '🥣' },

  // ============ SIGNATURE CAKES (Whole) ============
  { id: 'ca01', name: 'Bombay Coffee Cake - Large', category: 'cakes', price: 3600, desc: 'Signature Bombay coffee cake (whole, large)', imageUrl: 'images/products/bombay-coffee-cake-large.jpg', emoji: '🎂' },
  { id: 'ca02', name: 'Bombay Coffee Cake - Small', category: 'cakes', price: 2600, desc: 'Signature Bombay coffee cake (whole, small)', imageUrl: 'images/products/bombay-coffee-cake-small.jpg', emoji: '🎂' },
  { id: 'ca03', name: 'Belgian Chocolate Cake', category: 'cakes', price: 3600, desc: 'Whole Belgian chocolate cake', imageUrl: 'images/products/belgian-chocolate-cake.jpg', emoji: '🎂' },
  { id: 'ca04', name: 'Nutella Cake', category: 'cakes', price: 3800, desc: 'Whole Nutella cake', imageUrl: 'images/products/nutella-cake.jpg', emoji: '🎂' },
  { id: 'ca05', name: 'Ferrero Rocher Cake', category: 'cakes', price: 4500, desc: 'Whole Ferrero Rocher cake', imageUrl: 'images/products/ferrero-rocher-cake.jpg', emoji: '🎂' },
  { id: 'ca06', name: 'Milk Chocolate Très Leche Cake', category: 'cakes', price: 4600, desc: 'Whole milk chocolate tres leche cake', imageUrl: 'images/products/milk-chocolate-tr-s-leche-cake.jpg', emoji: '🎂', popular: true },
  { id: 'ca07', name: 'Nutella Très Leche Cake', category: 'cakes', price: 4200, desc: 'Whole Nutella tres leche cake', imageUrl: 'images/products/milk-chocolate-tr-s-leche-cake.jpg', emoji: '🎂' },
  { id: 'ca08', name: 'Salted Caramel Cake', category: 'cakes', price: 3950, desc: 'Whole salted caramel cake', imageUrl: 'images/products/salted-caramel-cake.jpg', emoji: '🎂' },
  { id: 'ca09', name: 'Date Cake w/ Sticky Toffee Sauce', category: 'cakes', price: 1200, desc: 'Date cake with sticky toffee sauce', imageUrl: 'images/products/date-loaf-with-sticky-toffee-sauce.jpg', emoji: '🎂' },
  { id: 'ca10', name: 'New York Cheesecake (Whole)', category: 'cakes', price: 7500, desc: 'Whole New York baked cheesecake', imageUrl: 'images/products/new-york-cheesecake.jpg', emoji: '🎂' },
  { id: 'ca11', name: 'Burnt Basque Cheesecake (Whole)', category: 'cakes', price: 12900, desc: 'Whole burnt Basque cheesecake', imageUrl: 'images/products/burnt-basque-cheesecake.jpg', emoji: '🎂' },
  { id: 'ca12', name: 'Lemon Cake', category: 'cakes', price: 990, desc: 'Whole lemon cake', imageUrl: 'images/products/lemon-cake-loaf.jpg', emoji: '🎂' },
  { id: 'ca13', name: 'Orange Cake', category: 'cakes', price: 1400, desc: 'Whole orange cake', imageUrl: 'images/products/orange-cake-loaf.jpg', emoji: '🎂' },
  { id: 'ca14', name: 'Chocolate Banana Walnut Bread', category: 'cakes', price: 1400, desc: 'Chocolate banana walnut bread loaf', imageUrl: 'images/products/chocolate-banana-walnut-bread.jpg', emoji: '🎂' },

  // ============ BY THE SLICE ============
  { id: 'sl01', name: 'Bombay Coffee Cake (Slice)', category: 'slices', price: 550, desc: 'A slice of our Bombay coffee cake', imageUrl: 'images/products/bombay-coffee-cake-slice.jpg', emoji: '🍰' },
  { id: 'sl02', name: 'Nutella Cake (Slice)', category: 'slices', price: 550, desc: 'A slice of Nutella cake', imageUrl: 'images/products/nutella-cake-slice.jpg', emoji: '🍰' },
  { id: 'sl03', name: 'Chocolate Banana Walnut Bread (Slice)', category: 'slices', price: 490, desc: 'A slice of chocolate banana walnut bread', imageUrl: 'images/products/chocolate-banana-walnut-bread-slice.jpg', emoji: '🍞' },
  { id: 'sl04', name: 'Orange Chocolate Flourless Cake (Slice)', category: 'slices', price: 550, desc: 'A slice of flourless orange chocolate cake', emoji: '🍰' },
  { id: 'sl05', name: 'New York Cheesecake (Slice)', category: 'slices', price: 750, desc: 'A slice of NY cheesecake', imageUrl: 'images/products/new-york-cheesecake-slice.jpg', emoji: '🍰', popular: true },
  { id: 'sl06', name: 'Burnt Basque Cheesecake (Slice)', category: 'slices', price: 1290, desc: 'A slice of burnt Basque cheesecake', imageUrl: 'images/products/burnt-basque-cheesecake-slice.jpg', emoji: '🍰' },

  // ============ FROM THE CHEF'S WHISK ============
  { id: 'cw01', name: 'Nutella Fudge Brownie', category: 'chef', price: 580, desc: 'Fudgy Nutella brownie', imageUrl: 'images/products/nutella-fudge-brownie.jpg', emoji: '🍫', popular: true },
  { id: 'cw02', name: 'Walnut Brownie', category: 'chef', price: 750, desc: 'Walnut loaded brownie', imageUrl: 'images/products/walnut-brownie.jpg', emoji: '🍫' },
  { id: 'cw03', name: 'Keto Brownie', category: 'chef', price: 690, desc: 'Sugar-free keto brownie', imageUrl: 'images/products/keto-brownie.jpg', emoji: '🍫' },
  { id: 'cw04', name: 'Double Chocolate Cookie', category: 'chef', price: 480, desc: 'Chewy double chocolate cookie', imageUrl: 'images/products/double-chocolate-cookie.jpg', emoji: '🍪' },
  { id: 'cw05', name: 'White Chocolate Kunafa Cookie', category: 'chef', price: 480, desc: 'Cookie with white choc & kunafa', imageUrl: 'images/products/white-chocolate-kunafa-cookie.jpg', emoji: '🍪' },
  { id: 'cw06', name: 'Chocolate Oatmeal Cookie', category: 'chef', price: 480, desc: 'Oatmeal cookie with chocolate chunks', imageUrl: 'images/products/chocolate-oatmeal-cookie.jpg', emoji: '🍪' },
  { id: 'cw07', name: 'Macaron', category: 'chef', price: 250, desc: 'Single French macaron', imageUrl: 'images/products/macaron.jpg', emoji: '🍡' },
  { id: 'cw08', name: 'Almond Biscotti', category: 'chef', price: 680, desc: 'Crunchy almond biscotti', imageUrl: 'images/products/almond-biscotti.jpg', emoji: '🍪' },

  // Financiers
  { id: 'cw09', name: 'Financier - Hazelnut', category: 'chef', price: 450, desc: 'French hazelnut financier cake', imageUrl: 'images/products/hazelnut-financier.jpg', emoji: '🍰' },
  { id: 'cw10', name: 'Financier - Chocolate', category: 'chef', price: 450, desc: 'French chocolate financier cake', imageUrl: 'images/products/chocolate-financier.jpg', emoji: '🍰' },
  { id: 'cw11', name: 'Financier - Pistachio Raspberry', category: 'chef', price: 550, desc: 'Pistachio raspberry financier', imageUrl: 'images/products/pistachio-and-raspberry-financier.jpg', emoji: '🍰' },

  // Doughnuts
  { id: 'cw12', name: 'Doughnut - Glazed', category: 'chef', price: 280, desc: 'Classic glazed doughnut', imageUrl: 'images/products/glazed-doughnut.jpg', emoji: '🍩' },
  { id: 'cw13', name: 'Doughnut - Chocolate', category: 'chef', price: 320, desc: 'Chocolate glazed doughnut', imageUrl: 'images/products/chocolate-doughnut.jpg', emoji: '🍩' },
  { id: 'cw14', name: 'Doughnut - Salted Caramel', category: 'chef', price: 320, desc: 'Salted caramel doughnut', imageUrl: 'images/products/salted-caramel-doughnut.jpg', emoji: '🍩' },
  { id: 'cw15', name: 'Doughnut - Boston Crème', category: 'chef', price: 360, desc: 'Boston crème filled doughnut', imageUrl: 'images/products/boston-cr-me-doughnut.jpg', emoji: '🍩' },
  { id: 'cw16', name: 'Doughnut - Nutella', category: 'chef', price: 360, desc: 'Nutella filled doughnut', imageUrl: 'images/products/nutella-doughnut.jpg', emoji: '🍩' },
  { id: 'cw17', name: 'Doughnut - Lotus Biscoff', category: 'chef', price: 360, desc: 'Lotus Biscoff doughnut', imageUrl: 'images/products/lotus-biscoff-doughnut.jpg', emoji: '🍩' },

  // ============ DELI & SANDWICHES ============
  { id: 'sw01', name: 'Grilled Chicken Ciabatta', category: 'sandwiches', price: 1250, desc: 'Oven-baked chicken, lettuce, cabbage, Mexican sauce, house ciabatta', imageUrl: 'images/products/grilled-chicken-ciabatta.jpg', emoji: '🥪', popular: true },
  { id: 'sw02', name: 'Moroccan Chicken Sourdough', category: 'sandwiches', price: 1250, desc: 'Grilled chicken fillet, iceberg, jalapeños, olive oil, Moroccan sauce, sourdough', imageUrl: 'images/products/moroccan-chicken-sourdough.jpg', emoji: '🥪' },
  { id: 'sw03', name: 'Chicken Cranberry Focaccia', category: 'sandwiches', price: 1390, desc: 'Stone-grilled chicken, tomato, rocket, pickled mayo, cranberry sauce, focaccia', imageUrl: 'images/products/chicken-cranberry-focaccia.jpg', emoji: '🥪' },
  { id: 'sw04', name: 'Turkey Club', category: 'sandwiches', price: 1590, desc: 'Turkey bacon, fried egg, cheddar, tomato, mayo, whole-wheat bread', imageUrl: 'images/products/turkey-club.jpg', emoji: '🥪' },
  { id: 'sw05', name: 'Smoked Chicken Croissant', category: 'sandwiches', price: 1350, desc: 'Smoked chicken, fried egg, cheddar, romaine, house French sauce, croissant', imageUrl: 'images/products/smoked-chicken-croissant.jpg', emoji: '🥐' },
  { id: 'sw06', name: 'Beef Barbacoa Melt', category: 'sandwiches', price: 1690, desc: 'Spicy slow-braised beef, chipotle, onions, cheddar, garlic, oregano, sourdough', imageUrl: 'images/products/beef-barbacoa-melt.jpg', emoji: '🥪', popular: true },

  // ============ COFFEES (HOT/ICED) ============
  { id: 'co01', name: 'Espresso', category: 'coffee', price: 500, desc: 'Single shot of pure espresso', imageUrl: 'images/products/espresso.jpg', emoji: '☕' },
  { id: 'co02', name: 'Ristretto', category: 'coffee', price: 450, desc: 'Restricted shot of espresso', imageUrl: 'images/products/ristretto.jpg', emoji: '☕' },
  { id: 'co03', name: 'Macchiato', category: 'coffee', price: 550, desc: 'Espresso marked with a dollop of milk', imageUrl: 'images/products/macchiato.jpg', emoji: '☕' },
  { id: 'co04', name: 'Cortado', category: 'coffee', price: 550, desc: 'Espresso cut with warm milk', imageUrl: 'images/products/cortado.jpg', emoji: '☕' },
  { id: 'co05', name: 'Americano', category: 'coffee', price: 550, desc: 'Espresso with hot water', imageUrl: 'images/products/americano.jpg', emoji: '☕' },
  { id: 'co06', name: 'Cappuccino', category: 'coffee', price: 690, desc: 'Espresso with steamed milk & foam', imageUrl: 'images/products/cappuccino.jpg', emoji: '☕', popular: true },
  { id: 'co07', name: 'Flat White', category: 'coffee', price: 690, desc: 'Double shot with microfoam', imageUrl: 'images/products/flat-white.jpg', emoji: '☕' },
  { id: 'co08', name: 'Lattè (Hot)', category: 'coffee', price: 690, desc: 'Espresso with steamed milk', imageUrl: 'images/products/cafe-latt.jpg', emoji: '☕' },
  { id: 'co09', name: 'Lattè (Iced)', category: 'coffee', price: 620, desc: 'Iced latte over ice', imageUrl: 'images/products/flavoured-latt.jpg', emoji: '🧋' },
  { id: 'co10', name: 'Flavoured Lattè (Hot)', category: 'coffee', price: 790, desc: 'Vanilla, Caramel, Hazelnut, Butterscotch, Crème Brûlée or Sugar-free', imageUrl: 'images/products/flavoured-latt.jpg', emoji: '☕' },
  { id: 'co11', name: 'Flavoured Lattè (Iced)', category: 'coffee', price: 720, desc: 'Iced flavoured latte', imageUrl: 'images/products/flavoured-latt.jpg', emoji: '🧋' },
  { id: 'co12', name: 'Spanish Lattè (Hot)', category: 'coffee', price: 790, desc: 'Creamy Spanish-style latte', imageUrl: 'images/products/spanish-latt.jpg', emoji: '☕' },
  { id: 'co13', name: 'Spanish Lattè (Iced)', category: 'coffee', price: 690, desc: 'Iced Spanish latte', imageUrl: 'images/products/spanish-latt.jpg', emoji: '🧋' },
  { id: 'co14', name: 'Mocha Lattè (Hot)', category: 'coffee', price: 850, desc: 'Chocolate & espresso latte', imageUrl: 'images/products/mocha-latt.jpg', emoji: '☕' },
  { id: 'co15', name: 'Mocha Lattè (Iced)', category: 'coffee', price: 750, desc: 'Iced mocha latte', imageUrl: 'images/products/mocha-latt.jpg', emoji: '🧋' },
  { id: 'co16', name: 'Iced Tiramisu Lattè', category: 'coffee', price: 1290, desc: 'Tiramisu-inspired iced latte', imageUrl: 'images/products/iced-tiramisu-latt.jpg', emoji: '🧋' },
  { id: 'co17', name: 'Frappuccino', category: 'coffee', price: 820, desc: 'Caramel, Hazelnut or Mocha', imageUrl: 'images/products/frappuccino.jpg', emoji: '🥤' },
  { id: 'co18', name: 'Affogato', category: 'coffee', price: 500, desc: 'Espresso poured over ice cream', imageUrl: 'images/products/affogato.jpg', emoji: '🍨' },

  // ============ MATCHA ============
  { id: 'ma01', name: 'Honey Matcha (Hot)', category: 'matcha', price: 980, desc: 'Hot matcha with honey', emoji: '🍵' },
  { id: 'ma02', name: 'Flavoured Matcha (Iced)', category: 'matcha', price: 980, desc: 'Vanilla, Coconut or Pistachio', emoji: '🍵' },
  { id: 'ma03', name: 'Strawberry Matcha w/ Cold Foam', category: 'matcha', price: 1090, desc: 'Iced matcha with strawberry & cold foam', emoji: '🍵' },
  { id: 'ma04', name: 'Matcha Frappuccino', category: 'matcha', price: 1090, desc: 'Blended matcha frappe', imageUrl: 'images/products/frappuccino.jpg', emoji: '🍵' },

  // ============ HOLD THE CAFFEINE ============
  { id: 'nc01', name: 'Wild Oreo Shake', category: 'ncaffeine', price: 650, desc: 'Oreo blended milkshake', emoji: '🥤', popular: true },
  { id: 'nc02', name: 'Signature Chocolate Shake', category: 'ncaffeine', price: 790, desc: 'House signature chocolate shake', imageUrl: 'images/products/mocha-frappuccino.jpg', emoji: '🥤' },
  { id: 'nc03', name: 'Mango Smoothie', category: 'ncaffeine', price: 750, desc: 'Fresh mango smoothie', emoji: '🥤' },
  { id: 'nc04', name: 'Strawberry Smoothie', category: 'ncaffeine', price: 750, desc: 'Fresh strawberry smoothie', emoji: '🥤' },
  { id: 'nc05', name: 'Signature Hot Chocolate', category: 'ncaffeine', price: 890, desc: 'Rich house hot chocolate', emoji: '🍫' },

  // ============ ON THE ROCKS ============
  { id: 'or01', name: 'Soda / Chiller', category: 'onrocks', price: 600, desc: 'Passionfruit, Raspberry, Mango, Strawberry or Peach', emoji: '🥤' },
  { id: 'or02', name: 'Mojito', category: 'onrocks', price: 620, desc: 'Wildberry, Mango or Sunset', emoji: '🍹' },

  // ============ TEA | ICED TEAS ============
  { id: 'te01', name: 'House Chai', category: 'tea', price: 380, desc: 'Traditional house chai', emoji: '🍵' },
  { id: 'te02', name: 'Black Tea w/ Milk', category: 'tea', price: 380, desc: 'Black tea with milk', emoji: '🍵' },
  { id: 'te03', name: 'Green Tea', category: 'tea', price: 380, desc: 'Lemon/Ginger or Chamomile', emoji: '🍵' },
  { id: 'te04', name: 'Iced Tea', category: 'tea', price: 600, desc: 'Raspberry or Peach', emoji: '🧊' },

  // ============ ADD-ONS ============
  { id: 'ad01', name: 'Whipped Cream', category: 'addons', price: 200, desc: 'Extra whipped cream', emoji: '🍦' },
  { id: 'ad02', name: 'Extra Shot', category: 'addons', price: 200, desc: 'Extra espresso shot', emoji: '☕' },
  { id: 'ad03', name: 'Extra Flavour', category: 'addons', price: 200, desc: 'Extra flavour syrup', emoji: '🍶' },
  { id: 'ad04', name: 'Extra Matcha', category: 'addons', price: 150, desc: 'Extra matcha shot', emoji: '🍵' },
  { id: 'ad05', name: 'Upsize Latte', category: 'addons', price: 200, desc: 'Upsize your latte', emoji: '⬆️' },
  { id: 'ad06', name: 'Upsize Frappuccino', category: 'addons', price: 300, desc: 'Upsize your frappuccino', imageUrl: 'images/products/frappuccino.jpg', emoji: '⬆️' },
  { id: 'ad07', name: 'Alternate Milk (Oat/Coconut)', category: 'addons', price: 850, desc: 'Oat or Coconut milk', emoji: '🥛' },
  { id: 'ad08', name: 'Low Fat Milk', category: 'addons', price: 150, desc: 'Low fat milk alternative', emoji: '🥛' }
];

// Category metadata (display name + icon)
const CATEGORIES = [
  { id: 'all',            name: 'All',            icon: '🍽️' },
  { id: 'breads',         name: 'Breads',         icon: '🥖' },
  { id: 'viennoiserie',   name: 'Viennoiserie',   icon: '🥐' },
  { id: 'patisserie',     name: 'Patisserie',     icon: '🥧' },
  { id: 'cakes',          name: 'Signature Cakes',icon: '🎂' },
  { id: 'slices',         name: 'By The Slice',   icon: '🍰' },
  { id: 'chef',           name: "Chef's Whisk",   icon: '🍫' },
  { id: 'sandwiches',     name: 'Sandwiches',     icon: '🥪' },
  { id: 'coffee',         name: 'Coffees',        icon: '☕' },
  { id: 'matcha',         name: 'Matcha',          icon: '🍵' },
  { id: 'ncaffeine',      name: 'No Caffeine',    icon: '🥤' },
  { id: 'onrocks',        name: 'On The Rocks',   icon: '🍹' },
  { id: 'tea',            name: 'Tea',             icon: '🍵' },
  { id: 'addons',         name: 'Add-Ons',        icon: '➕' }
];

// Expose globally
if (typeof window !== 'undefined') {
  window.MENU_DATA = MENU_DATA;
  window.CATEGORIES = CATEGORIES;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MENU_DATA, CATEGORIES };
}
