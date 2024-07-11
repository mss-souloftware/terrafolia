document.addEventListener('DOMContentLoaded', function() {
    var variantInputs = document.querySelectorAll('.product-form__swatch input[type="radio"], .product-form__swatch button');

    function updateVariantDisplay(e) {
        console.log('Variant changed'); // Debugging statement
        var selectedValue = e.target.tagName === 'BUTTON' ? e.target.getAttribute('data-value') : e.target.value;
        var optionName = e.target.name;
        var variantDisplay = document.getElementById('selected' + optionName);
        
        if(variantDisplay) {
            variantDisplay.textContent = selectedValue;
        }
    }

    variantInputs.forEach(function(input) {
        input.addEventListener('change', updateVariantDisplay);
        if(input.tagName === 'BUTTON') {
            input.addEventListener('click', updateVariantDisplay);
        }
    });

    console.log('DOMContentLoaded event listener set up.'); // Debugging statement
});