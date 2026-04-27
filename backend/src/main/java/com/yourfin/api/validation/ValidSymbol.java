package com.yourfin.api.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.*;

@Documented
@Constraint(validatedBy = SymbolValidator.class)
@Target({ ElementType.PARAMETER, ElementType.FIELD })
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidSymbol {
    String message() default "Invalid symbol format";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
