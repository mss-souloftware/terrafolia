class CartRemoveButton extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('click', (event) => {
      event.preventDefault();
      const cartItems = this.closest('cart-items') || this.closest('cart-drawer-items');
      cartItems.updateQuantity(this.dataset.index, 0);
    });
  }
}

customElements.define('cart-remove-button', CartRemoveButton);

class CartItems extends HTMLElement {
  constructor() {
    super();
    this.lineItemStatusElement =
      document.getElementById('shopping-cart-line-item-status') || document.getElementById('CartDrawer-LineItemStatus');

    const debouncedOnChange = debounce((event) => {
      this.onChange(event);
    }, ON_CHANGE_DEBOUNCE_TIMER);

    this.addEventListener('change', debouncedOnChange.bind(this));
  }

  cartUpdateUnsubscriber = undefined;

  connectedCallback() {
    this.cartUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
      if (event.source === 'cart-items') {
        return;
      }
      this.onCartUpdate();
    });
  }

  disconnectedCallback() {
    if (this.cartUpdateUnsubscriber) {
      this.cartUpdateUnsubscriber();
    }
  }

  onChange(event) {
    this.updateQuantity(
      event.target.dataset.index,
      event.target.value,
      document.activeElement.getAttribute('name'),
      event.target.dataset.quantityVariantId
    );
  }

  onCartUpdate() {
    if (this.tagName === 'CART-DRAWER-ITEMS') {
      fetch(`${routes.cart_url}?section_id=cart-drawer`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          const selectors = ['cart-drawer-items', '.cart-drawer__footer'];
          for (const selector of selectors) {
            const targetElement = document.querySelector(selector);
            const sourceElement = html.querySelector(selector);
            if (targetElement && sourceElement) {
              targetElement.replaceWith(sourceElement);
            }
          }
        })
        .catch((e) => {
          console.error(e);
        });
    } else {
      fetch(`${routes.cart_url}?section_id=main-cart-items`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          const sourceQty = html.querySelector('cart-items');
          this.innerHTML = sourceQty.innerHTML;
        })
        .catch((e) => {
          console.error(e);
        });
    }
  }

  getSectionsToRender() {
    return [
      {
        id: 'main-cart-items',
        section: document.getElementById('main-cart-items').dataset.id,
        selector: '.js-contents',
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section',
      },
      {
        id: 'cart-live-region-text',
        section: 'cart-live-region-text',
        selector: '.shopify-section',
      },
      {
        id: 'main-cart-footer',
        section: document.getElementById('main-cart-footer').dataset.id,
        selector: '.js-contents',
      },
    ];
  }

  updateQuantity(line, quantity, name, variantId) {
    this.enableLoading(line);

    const cartEmail = document.querySelector('#cartEmail') ? document.querySelector('#cartEmail').value : '';
    const cartPhone = document.querySelector('#cartPhone') ? document.querySelector('#cartPhone').value : '';
    const cartFname = document.querySelector('#cartFname') ? document.querySelector('#cartFname').value : '';
    const cartLname = document.querySelector('#cartLname') ? document.querySelector('#cartLname').value : '';
    const cartAddress = document.querySelector('#cartAddress') ? document.querySelector('#cartAddress').value : '';
    const cartApartment = document.querySelector('#cartApartment') ? document.querySelector('#cartApartment').value : '';
    const cartCity = document.querySelector('#cartCity') ? document.querySelector('#cartCity').value : '';
    const cartProvince = document.querySelector('#cartProvince') ? document.querySelector('#cartProvince').value : '';
    const cartPostal = document.querySelector('#cartPostal') ? document.querySelector('#cartPostal').value : '';
    const cartRphone = document.querySelector('#cartRphone') ? document.querySelector('#cartRphone').value : '';
    const cartSdelivery = document.querySelector('#cartSdelivery') ? document.querySelector('#cartSdelivery').value : '';

    const body = JSON.stringify({
      line,
      quantity,
      sections: this.getSectionsToRender().map((section) => section.section),
      sections_url: window.location.pathname,
      attributes: {
        Email: cartEmail,
        Phone: cartPhone,
        First_Name: cartFname,
        Last_Name: cartLname,
        Address: cartAddress,
        Apartment: cartApartment,
        City: cartCity,
        Province: cartProvince,
        Postal: cartPostal,
        Recipient_Phone: cartRphone,
        Special_Delivery: cartSdelivery,
      }
    });

    fetch(`${routes.cart_change_url}`, { ...fetchConfig(), ...{ body } })
      .then((response) => response.text())
      .then((state) => {
        const parsedState = JSON.parse(state);
        const quantityElement =
          document.getElementById(`Quantity-${line}`) || document.getElementById(`Drawer-quantity-${line}`);
        const items = document.querySelectorAll('.cart-item');

        if (parsedState.errors) {
          quantityElement.value = quantityElement.getAttribute('value');
          this.updateLiveRegions(line, parsedState.errors);
          return;
        }

        this.classList.toggle('is-empty', parsedState.item_count === 0);
        const cartDrawerWrapper = document.querySelector('cart-drawer');
        const cartFooter = document.getElementById('main-cart-footer');

        if (cartFooter) cartFooter.classList.toggle('is-empty', parsedState.item_count === 0);
        if (cartDrawerWrapper) cartDrawerWrapper.classList.toggle('is-empty', parsedState.item_count === 0);

        this.getSectionsToRender().forEach((section) => {
          const elementToReplace =
            document.getElementById(section.id).querySelector(section.selector) || document.getElementById(section.id);
          elementToReplace.innerHTML = this.getSectionInnerHTML(
            parsedState.sections[section.section],
            section.selector
          );
        });
        const updatedValue = parsedState.items[line - 1] ? parsedState.items[line - 1].quantity : undefined;
        let message = '';
        if (items.length === parsedState.items.length && updatedValue !== parseInt(quantityElement.value)) {
          if (typeof updatedValue === 'undefined') {
            message = window.cartStrings.error;
          } else {
            message = window.cartStrings.quantityError.replace('[quantity]', updatedValue);
          }
        }
        this.updateLiveRegions(line, message);

        const lineItem =
          document.getElementById(`CartItem-${line}`) || document.getElementById(`CartDrawer-Item-${line}`);
        if (lineItem && lineItem.querySelector(`[name="${name}"]`)) {
          cartDrawerWrapper
            ? trapFocus(cartDrawerWrapper, lineItem.querySelector(`[name="${name}"]`))
            : lineItem.querySelector(`[name="${name}"]`).focus();
        } else if (parsedState.item_count === 0 && cartDrawerWrapper) {
          trapFocus(cartDrawerWrapper.querySelector('.drawer__inner-empty'), cartDrawerWrapper.querySelector('a'));
        } else if (document.querySelector('.cart-item') && cartDrawerWrapper) {
          trapFocus(cartDrawerWrapper, document.querySelector('.cart-item__name'));
        }

        publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-items', cartData: parsedState, variantId: variantId });
      })
      .catch(() => {
        this.querySelectorAll('.loading__spinner').forEach((overlay) => overlay.classList.add('hidden'));
        const errors = document.getElementById('cart-errors') || document.getElementById('CartDrawer-CartErrors');
        errors.textContent = window.cartStrings.error;
      })
      .finally(() => {
        this.disableLoading(line);
      });
  }

  updateLiveRegions(line, message) {
    const lineItemError =
      document.getElementById(`Line-item-error-${line}`) || document.getElementById(`CartDrawer-LineItemError-${line}`);
    if (lineItemError) lineItemError.querySelector('.cart-item__error-text').innerHTML = message;

    this.lineItemStatusElement.setAttribute('aria-hidden', true);

    const cartStatus =
      document.getElementById('cart-live-region-text') || document.getElementById('CartDrawer-LiveRegionText');
    cartStatus.setAttribute('aria-hidden', false);

    setTimeout(() => {
      cartStatus.setAttribute('aria-hidden', true);
    }, 1000);
  }

  getSectionInnerHTML(html, selector) {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector).innerHTML;
  }

  enableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    mainCartItems.classList.add('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

    [...cartItemElements, ...cartDrawerItemElements].forEach((overlay) => overlay.classList.remove('hidden'));

    document.activeElement.blur();
    this.lineItemStatusElement.setAttribute('aria-hidden', false);
  }

  disableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    mainCartItems.classList.remove('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

    cartItemElements.forEach((overlay) => overlay.classList.add('hidden'));
    cartDrawerItemElements.forEach((overlay) => overlay.classList.add('hidden'));
  }
}

customElements.define('cart-items', CartItems);

if (!customElements.get('cart-note')) {
  customElements.define(
    'cart-note',
    class CartNote extends HTMLElement {
      constructor() {
        super();

        this.addEventListener(
          'input',
          debounce((event) => {
            const body = JSON.stringify({ note: event.target.value });
            fetch(`${routes.cart_update_url}`, { ...fetchConfig(), ...{ body } });
          }, ON_CHANGE_DEBOUNCE_TIMER)
        );
      }
    }
  );
}


(function ($) {
  $(document).ready(function () {
    $("#cartPhone, #cartRphone").inputmask("(999) 999-9999");

    let $email = $("#cartEmail");
    let $phone = $("#cartPhone");
    let $fname = $("#cartFname");
    let $lname = $("#cartLname");
    let $address = $("#cartAddress");
    let $city = $("#cartCity");
    let $province = $("#cartProvince");
    let $postal = $("#cartPostal");
    let $rPhone = $("#cartRphone");

    let $inputs;

    function updateInputListeners() {
      // Remove previous listeners
      if ($inputs) {
        $inputs.off('input');
      }

      $inputs.on('input', function () {
        let allFilled = true;

        $inputs.each(function () {
          if ($(this).val() === '') {
            allFilled = false;
            return false; // Exit the each loop early if any input is empty
          }
        });

        if (allFilled) {
          $("#continueBtn").removeAttr("disabled");
        } else {
          $("#continueBtn").attr("disabled", "disabled");
        }
      });
    }

    $(".pickupLocations").css("display", "none");
    $(".locationMaps").css("display", "none");

    $("#deliveryPickup").on("change", function () {
      if ($(this).is(":checked")) {
        $(".extraDetails").css("display", "block");
        $(".pickupLocations").css("display", "none");
        $(".locationMaps").css("display", "none");
        $(".pickupLocationsPanel .pickupLocationsInner").removeClass("active");

        $inputs = $($email).add($phone).add($fname).add($lname).add($address).add($city).add($province).add($postal).add($rPhone);
      } else {
        $(".extraDetails").css("display", "none");
        $(".pickupLocations").css("display", "block");

        $inputs = $($email).add($phone);
      }

      // Update the input listeners
      updateInputListeners();

      // Trigger input event to set initial state of the button
      $inputs.trigger('input');
    });

    // Initial setup based on the checkbox state
    if ($("#deliveryPickup").is(":checked")) {
      $inputs = $($email).add($phone).add($fname).add($lname).add($address).add($city).add($province).add($postal).add($rPhone);
    } else {
      $inputs = $($email).add($phone);
    }

    // Set up the input listeners initially
    updateInputListeners();

    // Trigger input event to set initial state of the button
    $inputs.trigger('input');

    $(".pickupLocationsPanel .pickupLocationsInner").on("click", function () {
      $(".pickupLocationsPanel .pickupLocationsInner").removeClass("active");
      $(this).addClass("active");
      $(".locationMaps").css("display", "block");
      let lctionVal = $(this).attr("data-location");

      if (lctionVal === "Westmount") {
        $(".locationMaps .locationMapsInner:last-child").css("display", "none");
        $(".locationMaps .locationMapsInner:first-child").css("display", "block");
      } else {
        $(".locationMaps .locationMapsInner:last-child").css("display", "block");
        $(".locationMaps .locationMapsInner:first-child").css("display", "none");
      }
    })

    $(".next").click(function () {
      let allFilled = true;
      let emailValid = true;

      $inputs.each(function () {
        if ($(this).val() === '') {
          allFilled = false;
          $(this).addClass('error'); // Optionally, add error class to highlight the field
          return false; // Exit the each loop early if any input is empty
        } else {
          $(this).removeClass('error'); // Remove error class if the field is filled
        }
      });

      // Check if email is valid
      let emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test($email.val())) {
        emailValid = false;
        $email.addClass('error');
      } else {
        $email.removeClass('error');
      }

      if (allFilled && emailValid) {
        var current_fs = $(this).parent();
        var next_fs = $(this).parent().next();

        // Add Class Active
        $("#progressbar li").eq($("fieldset").index(next_fs)).addClass("active");

        // Show the next fieldset
        next_fs.show();
        // Hide the current fieldset with style
        current_fs.animate({ opacity: 0 }, {
          step: function (now) {
            // For making fieldset appear animation
            var opacity = 1 - now;
            current_fs.css({
              'display': 'none',
              'position': 'relative'
            });
            next_fs.css({ 'opacity': opacity });
          },
          duration: 500
        });
      }
    });

    $(".previous").click(function () {
      var current_fs = $(this).parent();
      var previous_fs = $(this).parent().prev();

      // Remove class active
      $("#progressbar li").eq($("fieldset").index(current_fs)).removeClass("active");

      // Show the previous fieldset
      previous_fs.show();

      // Hide the current fieldset with style
      current_fs.animate({ opacity: 0 }, {
        step: function (now) {
          // For making fieldset appear animation
          var opacity = 1 - now;
          current_fs.css({
            'display': 'none',
            'position': 'relative'
          });
          previous_fs.css({ 'opacity': opacity });
        },
        duration: 500
      });
    });

    function setProgressBar(curStep) {
      var steps = $("fieldset").length;
      var percent = parseFloat(100 / steps) * curStep;
      percent = percent.toFixed();
      $(".progress-bar").css("width", percent + "%");
    }

    $(".submit").click(function () {
      return false;
    });

    console.log("script cart");
  });
})(jQuery);