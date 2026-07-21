package com.busbd.intelligence.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Prevents a cached HTML shell from referencing a JavaScript bundle that no
 * longer exists after a new Render deployment. Hashed Vite assets remain
 * cacheable because their URL changes whenever their content changes.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class StaticAssetCacheFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String uri = request.getRequestURI();

        if (isApplicationShell(uri)) {
            response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
            response.setHeader("Pragma", "no-cache");
            response.setDateHeader("Expires", 0);
        } else if (uri.startsWith("/assets/")) {
            response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }

        filterChain.doFilter(request, response);
    }

    private boolean isApplicationShell(String uri) {
        return uri.equals("/")
                || uri.equals("/index.html")
                || uri.equals("/deployment.json")
                || uri.equals("/login")
                || uri.equals("/dashboard")
                || uri.equals("/tracking")
                || uri.equals("/trips")
                || uri.equals("/support")
                || uri.equals("/operations")
                || uri.startsWith("/booking/")
                || uri.equals("/app")
                || uri.startsWith("/app/");
    }
}
