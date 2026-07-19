package com.busbd.intelligence.controller;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.Map;
import java.util.NoSuchElementException;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler({IllegalArgumentException.class, IllegalStateException.class})
    ResponseEntity<Map<String, Object>> badRequest(RuntimeException ex) { return response(HttpStatus.BAD_REQUEST, ex.getMessage()); }
    @ExceptionHandler(SecurityException.class)
    ResponseEntity<Map<String, Object>> forbidden(SecurityException ex) { return response(HttpStatus.FORBIDDEN, ex.getMessage()); }
    @ExceptionHandler(NoSuchElementException.class)
    ResponseEntity<Map<String, Object>> notFound(NoSuchElementException ex) { return response(HttpStatus.NOT_FOUND, ex.getMessage()); }
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<Map<String, Object>> conflict(DataIntegrityViolationException ex) { return response(HttpStatus.CONFLICT, "A selected seat was booked by another passenger. Please choose again."); }
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<Map<String, Object>> validation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream().findFirst().map(e -> e.getField() + ": " + e.getDefaultMessage()).orElse("Validation failed");
        return response(HttpStatus.BAD_REQUEST, message);
    }
    private ResponseEntity<Map<String, Object>> response(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(Map.of("timestamp", Instant.now(), "status", status.value(), "error", message));
    }
}
