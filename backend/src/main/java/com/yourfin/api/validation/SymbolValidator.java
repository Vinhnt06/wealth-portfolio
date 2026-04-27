package com.yourfin.api.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class SymbolValidator implements ConstraintValidator<ValidSymbol, String> {

    private static final String SYMBOL_PATTERN = "^[A-Z0-9]{1,20}$";

    @Override
    public boolean isValid(String symbol, ConstraintValidatorContext context) {
        if (symbol == null || symbol.isEmpty()) {
            return false;
        }

        // Check length
        if (symbol.length() > 20) {
            return false;
        }

        // Check pattern (alphanumeric uppercase only)
        if (!symbol.matches(SYMBOL_PATTERN)) {
            return false;
        }

        // Prevent common injection patterns
        if (symbol.contains("--") || symbol.contains("/*") || symbol.contains("*/")) {
            return false;
        }

        return true;
    }
}
